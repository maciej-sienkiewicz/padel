import createContextHook from '@/utils/createContextHook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert, ToastAndroid } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import type { VideoFile } from 'react-native-vision-camera';
import FirebaseService from '@/services/FirebaseService';
import { firebaseConfig } from '@/config/firebase';
import type { P2PMessage } from '@/services/FirebaseService';
import VideoMerger from '@/modules/VideoMerger';
import RecordingConfig from '@/constants/recording';

/**
 * 🎯 ROLLING BUFFER ARCHITECTURE
 *
 * Zamiast jednego długiego nagrania, nagrywamy w segmentach:
 * - Segment duration: 5 minut (kompromis między gaps a zarządzaniem pamięcią)
 * - Buffer size: 15 minut (3 segmenty)
 * - Auto-cleanup: segmenty starsze niż 15 minut są usuwane
 *
 * Gap: ~30-50ms co 5 minut (prawie niezauważalne)
 * Pamięć: max ~500MB (zamiast 3GB dla godzinnego meczu)
 */

const SEGMENT_DURATION = 10; // 5 minut w sekundach
const BUFFER_DURATION = 900;  // 15 minut w sekundach (3 segmenty)

interface VideoSegment {
    uri: string;
    startTime: number; // timestamp kiedy segment się rozpoczął
    duration: number;   // faktyczna długość w ms
}

interface Highlight {
    id: string;
    timestamp: Date;
    duration: number;
    uri: string;
}

interface ProcessingState {
    isProcessing: boolean;
    highlightId: string | null;
    progress: string;
}

export const [RecordingProvider, useRecording] = createContextHook(() => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [deviceRole, setDeviceRole] = useState<'camera' | 'remote' | null>(null);
    const [serverAddress, setServerAddress] = useState<string>('');
    const [processingState, setProcessingState] = useState<ProcessingState>({
        isProcessing: false,
        highlightId: null,
        progress: '',
    });

    // Permissions
    const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
    const { hasPermission: hasMicrophonePermission, requestPermission: requestMicrophonePermission } = useMicrophonePermission();
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    // Camera device
    const device = useCameraDevice('back');

    // Refs
    const cameraRef = useRef<Camera | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const videoSegments = useRef<VideoSegment[]>([]);
    const currentSegmentStartTime = useRef<number>(0);
    const messageUnsubscribe = useRef<(() => void) | null>(null);
    const connectionUnsubscribe = useRef<(() => void) | null>(null);

    const showToast = useCallback((message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.LONG);
        }
        console.log('📱 Toast:', message);
    }, []);

    useEffect(() => {
        try {
            FirebaseService.initialize(firebaseConfig);
            console.log('✅ Firebase initialized');
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }

        loadHighlights();

        return () => {
            disconnect();
        };
    }, []);

    const loadHighlights = useCallback(async () => {
        try {
            const highlightDir = `${FileSystem.documentDirectory}${RecordingConfig.HIGHLIGHTS_FOLDER}`;
            const dirInfo = await FileSystem.getInfoAsync(highlightDir);

            if (dirInfo.exists) {
                const files = await FileSystem.readDirectoryAsync(highlightDir);
                const loadedHighlights = files
                    .filter(f => f.endsWith('.mp4'))
                    .map(filename => {
                        const id = filename.replace('.mp4', '');
                        const timestamp = parseInt(id.split('_')[1]) || Date.now();

                        return {
                            id,
                            timestamp: new Date(timestamp),
                            duration: RecordingConfig.BUFFER_DURATION,
                            uri: `${highlightDir}${filename}`,
                        };
                    });

                setHighlights(loadedHighlights.sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                ));
            }
        } catch (error) {
            console.error('Failed to load highlights:', error);
        }
    }, []);

    /**
     * 🧹 Clean old segments from buffer
     */
    const cleanOldSegments = useCallback(() => {
        const now = Date.now();
        const cutoffTime = now - (BUFFER_DURATION * 1000);

        const oldSegments = videoSegments.current.filter(
            seg => seg.startTime < cutoffTime
        );

        // Delete old segment files
        oldSegments.forEach(async (seg) => {
            try {
                await FileSystem.deleteAsync(seg.uri, { idempotent: true });
                console.log(`🗑️ Deleted old segment: ${new Date(seg.startTime).toISOString()}`);
            } catch (error) {
                console.warn('Failed to delete old segment:', error);
            }
        });

        // Keep only recent segments
        videoSegments.current = videoSegments.current.filter(
            seg => seg.startTime >= cutoffTime
        );

        console.log(`📦 Buffer: ${videoSegments.current.length} segments (${(videoSegments.current.length * SEGMENT_DURATION / 60).toFixed(1)} min)`);
    }, []);

    /**
     * 🎬 CAPTURE HIGHLIGHT - Extract from rolling buffer
     */
    const captureHighlight = useCallback(async (requestedDuration: number = 120) => {
        console.log('🎬 Capture highlight requested:', requestedDuration, 'seconds');

        if (!isRecordingRef.current) {
            Alert.alert('Błąd', 'Nagrywanie nie jest aktywne');
            return;
        }

        if (processingState.isProcessing) {
            showToast('⏳ Proszę czekać, przetwarzam poprzednie nagranie...');
            return;
        }

        // Check if requested duration fits in buffer
        if (requestedDuration > BUFFER_DURATION) {
            Alert.alert(
                'Za długi fragment',
                `Maksymalna długość to ${BUFFER_DURATION / 60} minut.\nBuffer trzyma tylko ostatnie ${BUFFER_DURATION / 60} minut.`
            );
            return;
        }

        // Pause current segment to finalize it
        if (!cameraRef.current) {
            Alert.alert('Błąd', 'Kamera nie jest dostępna');
            return;
        }

        try {
            console.log('⏸️ Pausing to finalize current segment...');
            await cameraRef.current.pauseRecording();

            // Wait for segment to finalize
            await new Promise(resolve => setTimeout(resolve, 500));

            const now = Date.now();
            const globalStartTime = now - (requestedDuration * 1000);

            // Find relevant segments
            const relevantSegments = videoSegments.current.filter(seg => {
                const segmentEnd = seg.startTime + seg.duration;
                return segmentEnd > globalStartTime && seg.startTime < now;
            }).sort((a, b) => a.startTime - b.startTime);

            if (relevantSegments.length === 0) {
                Alert.alert(
                    'Brak nagrań',
                    `Nie ma nagrań z ostatnich ${requestedDuration}s.\nSpróbuj ponownie za chwilę.`
                );
                await cameraRef.current.resumeRecording();
                return;
            }

            console.log(`📊 Found ${relevantSegments.length} relevant segments`);

            setProcessingState({
                isProcessing: true,
                highlightId: `capture_${now}`,
                progress: `Łączę ${relevantSegments.length} segmentów...`,
            });

            if (!mediaPermission?.granted) {
                const { granted } = await requestMediaPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do zapisywania w galerii');
                    setProcessingState({ isProcessing: false, highlightId: null, progress: '' });
                    await cameraRef.current.resumeRecording();
                    return;
                }
            }

            const highlightDir = `${FileSystem.documentDirectory}${RecordingConfig.HIGHLIGHTS_FOLDER}`;
            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            const highlightId = `highlight_${now}`;
            const outputUri = `${highlightDir}${highlightId}.mp4`;

            console.log('🔄 Merging segments...');

            const mergedPath = await VideoMerger.mergePreciseClip(
                relevantSegments.map(seg => seg.uri),
                globalStartTime,
                requestedDuration,
                relevantSegments.map(seg => seg.startTime),
                outputUri
            );

            console.log('✅ Merge completed:', mergedPath);

            // Save to gallery
            setProcessingState({
                isProcessing: true,
                highlightId,
                progress: 'Zapisywanie do galerii...',
            });

            const asset = await MediaLibrary.createAssetAsync(mergedPath);
            const albums = await MediaLibrary.getAlbumsAsync();
            const existingAlbum = albums.find(album => album.title === RecordingConfig.GALLERY_ALBUM_NAME);

            if (existingAlbum) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
            } else {
                await MediaLibrary.createAlbumAsync(RecordingConfig.GALLERY_ALBUM_NAME, asset, false);
            }

            const newHighlight: Highlight = {
                id: highlightId,
                timestamp: new Date(now),
                duration: requestedDuration,
                uri: mergedPath,
            };

            setHighlights((prev) => [newHighlight, ...prev]);

            setProcessingState({
                isProcessing: false,
                highlightId: null,
                progress: '',
            });

            showToast(`✅ Akcja ${requestedDuration}s zapisana!`);

            // Resume recording
            console.log('▶️ Resuming recording...');
            await cameraRef.current.resumeRecording();
            console.log('✅ Recording resumed');

        } catch (error) {
            console.error('❌ Capture failed:', error);

            setProcessingState({
                isProcessing: false,
                highlightId: null,
                progress: '',
            });

            Alert.alert('Błąd', `Nie udało się zapisać akcji: ${error}`);

            // Try to resume
            try {
                if (cameraRef.current && isRecordingRef.current) {
                    await cameraRef.current.resumeRecording();
                }
            } catch (resumeError) {
                console.error('❌ Failed to resume:', resumeError);
            }
        }
    }, [mediaPermission, requestMediaPermission, processingState, showToast, cleanOldSegments]);

    const startAsCamera = useCallback(async () => {
        try {
            if (!hasCameraPermission) {
                const granted = await requestCameraPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do kamery');
                    return;
                }
            }

            if (!hasMicrophonePermission) {
                const granted = await requestMicrophonePermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do mikrofonu');
                    return;
                }
            }

            FirebaseService.setDeviceRole('camera');
            const sessionId = await FirebaseService.startAsCamera();
            setServerAddress(sessionId);
            setDeviceRole('camera');

            messageUnsubscribe.current = FirebaseService.onMessage((message: P2PMessage) => {
                console.log('📹 Camera received:', message.type);

                if (message.type === 'capture') {
                    const duration = (message.duration || 120);
                    console.log(`🎬 Capture signal! Duration: ${duration}s`);
                    captureHighlight(duration);
                }
            });

            connectionUnsubscribe.current = FirebaseService.onConnection((connected) => {
                setIsConnected(connected);
                if (connected) {
                    console.log('✅ Pilot connected');
                    Alert.alert('Połączono', 'Pilot został połączony!');
                }
            });

            console.log('✅ Camera mode ready');
            console.log(`🔑 Session ID: ${sessionId}`);

        } catch (error) {
            console.error('Failed to start camera:', error);
            Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery.');
        }
    }, [hasCameraPermission, hasMicrophonePermission, requestCameraPermission, requestMicrophonePermission, captureHighlight]);

    const connectToCamera = useCallback(async (sessionId: string) => {
        try {
            FirebaseService.setDeviceRole('remote');
            const connected = await FirebaseService.connectToCamera(sessionId);

            if (connected) {
                setIsConnected(true);
                setServerAddress('Connected');
                setDeviceRole('remote');

                messageUnsubscribe.current = FirebaseService.onMessage((message: P2PMessage) => {
                    console.log('🎮 Remote received:', message.type);
                });

                console.log('✅ Connected to camera');
                Alert.alert('Sukces', 'Połączono z kamerą!');
            }
        } catch (error) {
            console.error('Failed to connect:', error);
            setIsConnected(false);
            Alert.alert('Błąd połączenia', 'Nie udało się połączyć z kamerą.');
        }
    }, []);

    const sendCaptureSignal = useCallback((duration: number = 120) => {
        if (!isConnected) {
            Alert.alert('Błąd', 'Brak połączenia z kamerą');
            return;
        }

        FirebaseService.sendMessage({
            type: 'capture',
            timestamp: Date.now(),
            duration: duration
        });

        console.log(`📤 Capture signal sent (${duration}s)`);
    }, [isConnected]);

    const disconnect = useCallback(() => {
        if (messageUnsubscribe.current) {
            messageUnsubscribe.current();
            messageUnsubscribe.current = null;
        }

        if (connectionUnsubscribe.current) {
            connectionUnsubscribe.current();
            connectionUnsubscribe.current = null;
        }

        FirebaseService.disconnect();
        setIsConnected(false);
        setDeviceRole(null);
        setServerAddress('');

        if (isRecordingRef.current) {
            stopRecording();
        }
    }, []);

    /**
     * 🎥 START RECORDING - Segment-based with rolling buffer
     */
    const startRecording = useCallback(async () => {
        if (!cameraRef.current) {
            Alert.alert('Błąd', 'Kamera nie jest gotowa');
            return;
        }

        if (!device) {
            Alert.alert('Błąd', 'Urządzenie kamery nie znalezione');
            return;
        }

        try {
            console.log(`🎥 Starting segment-based recording (${SEGMENT_DURATION}s segments, ${BUFFER_DURATION}s buffer)`);

            setIsRecording(true);
            isRecordingRef.current = true;
            videoSegments.current = [];

            const recordSegment = async (): Promise<void> => {
                if (!isRecordingRef.current || !cameraRef.current) {
                    return;
                }

                currentSegmentStartTime.current = Date.now();
                console.log(`📹 Recording segment starting at ${new Date(currentSegmentStartTime.current).toISOString()}`);

                try {
                    cameraRef.current.startRecording({
                        flash: 'off',
                        onRecordingFinished: async (video: VideoFile) => {
                            const segmentEndTime = Date.now();
                            const actualDuration = segmentEndTime - currentSegmentStartTime.current;

                            const segment: VideoSegment = {
                                uri: video.path,
                                startTime: currentSegmentStartTime.current,
                                duration: actualDuration,
                            };

                            videoSegments.current.push(segment);
                            console.log(`✅ Segment recorded: ${(actualDuration / 1000).toFixed(1)}s`);

                            // Clean old segments
                            cleanOldSegments();

                            // Continue recording if still active
                            if (isRecordingRef.current) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                                await recordSegment();
                            }
                        },
                        onRecordingError: (error) => {
                            console.error('❌ Segment recording error:', error);
                            Alert.alert('Błąd nagrywania', error.message);
                            setIsRecording(false);
                            isRecordingRef.current = false;
                        },
                    });

                    // Auto-stop after SEGMENT_DURATION
                    setTimeout(async () => {
                        if (isRecordingRef.current && cameraRef.current) {
                            try {
                                await cameraRef.current.stopRecording();
                            } catch (error) {
                                console.warn('Auto-stop warning:', error);
                            }
                        }
                    }, SEGMENT_DURATION * 1000);

                } catch (error) {
                    console.error('❌ Failed to start segment:', error);
                }
            };

            await recordSegment();

        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Błąd', 'Nie udało się rozpocząć nagrywania');
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    }, [device, cleanOldSegments]);

    /**
     * 🛑 STOP RECORDING
     */
    const stopRecording = useCallback(async () => {
        console.log('🛑 Stopping recording...');

        if (!cameraRef.current || !isRecordingRef.current) {
            return;
        }

        setIsRecording(false);
        isRecordingRef.current = false;

        try {
            await cameraRef.current.stopRecording();
            console.log('✅ Recording stopped');
        } catch (error) {
            console.warn('Stop error:', error);
        }

        // Clean up all segments after delay
        setTimeout(async () => {
            for (const segment of videoSegments.current) {
                try {
                    await FileSystem.deleteAsync(segment.uri, { idempotent: true });
                } catch (error) {
                    console.warn('Delete error:', error);
                }
            }
            videoSegments.current = [];
            console.log('🗑️ All segments cleaned up');
        }, 30000);

    }, []);

    const deleteHighlight = useCallback(async (id: string) => {
        try {
            const highlight = highlights.find(h => h.id === id);
            if (highlight) {
                await FileSystem.deleteAsync(highlight.uri, { idempotent: true });

                try {
                    const assets = await MediaLibrary.getAssetsAsync({
                        first: 1000,
                        album: RecordingConfig.GALLERY_ALBUM_NAME,
                    });

                    const asset = assets.assets.find(a => a.uri === highlight.uri);
                    if (asset) {
                        await MediaLibrary.deleteAssetsAsync([asset]);
                    }
                } catch (error) {
                    console.warn('Gallery delete error:', error);
                }

                setHighlights(prev => prev.filter(h => h.id !== id));
                console.log('✅ Highlight deleted:', id);
            }
        } catch (error) {
            console.error('Failed to delete highlight:', error);
        }
    }, [highlights]);

    const setCameraReference = useCallback((ref: Camera | null) => {
        cameraRef.current = ref;
    }, []);

    return useMemo(() => ({
        isRecording,
        highlights,
        isConnected,
        deviceRole,
        serverAddress,
        processingState,
        device,
        startRecording,
        stopRecording,
        captureHighlight,
        deleteHighlight,
        startAsCamera,
        connectToCamera,
        sendCaptureSignal,
        disconnect,
        setCameraReference,
    }), [
        isRecording,
        highlights,
        isConnected,
        deviceRole,
        serverAddress,
        processingState,
        device,
        startRecording,
        stopRecording,
        captureHighlight,
        deleteHighlight,
        startAsCamera,
        connectToCamera,
        sendCaptureSignal,
        disconnect,
        setCameraReference,
    ]);
});