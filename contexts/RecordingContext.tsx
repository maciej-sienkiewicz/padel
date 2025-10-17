import createContextHook from '@/utils/createContextHook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert, ToastAndroid } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import FirebaseService from '@/services/FirebaseService';
import { firebaseConfig } from '@/config/firebase';
import type { P2PMessage } from '@/services/FirebaseService';
import VideoMerger from '@/modules/VideoMerger';
import RecordingConfig from '@/constants/recording';

interface VideoSegment {
    uri: string;
    timestamp: number;
    duration: number;
    recordedAt: number;
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
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    const videoSegments = useRef<VideoSegment[]>([]);
    const cameraRef = useRef<CameraView | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const messageUnsubscribe = useRef<(() => void) | null>(null);
    const connectionUnsubscribe = useRef<(() => void) | null>(null);
    const recordingStartTime = useRef<number>(0);

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
     * 🎯 CAPTURE HIGHLIGHT - POPRAWIONA LOGIKA
     *
     * KLUCZOWE ZMIANY:
     * 1. Zatrzymuje aktualny segment przed wycinaniem (aby mieć pełne requestedDuration)
     * 2. Prawidłowo oblicza które segmenty potrzebujemy
     * 3. Automatycznie wznawia nagrywanie po wycinaniu
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

        // 🔥 KRYTYCZNE: Zatrzymaj aktualny segment aby go sfinalizować
        console.log('⏸️ Pausing recording to finalize current segment...');
        const wasRecording = isRecordingRef.current;

        try {
            if (cameraRef.current) {
                await cameraRef.current.stopRecording();
            }
        } catch (error) {
            console.warn('⚠️ Stop recording warning:', error);
        }

        // Poczekaj chwilę aż segment zostanie dodany do bufora
        await new Promise(resolve => setTimeout(resolve, 500));

        const now = Date.now();
        const requestedStartTime = now - (requestedDuration * 1000);

        console.log('⏱️ Time range:');
        console.log(`   Now: ${new Date(now).toISOString()}`);
        console.log(`   Requested start: ${new Date(requestedStartTime).toISOString()}`);
        console.log(`   Duration: ${requestedDuration}s`);

        // Znajdź wszystkie segmenty które pokrywają się z naszym zakresem czasowym
        const relevantSegments = videoSegments.current
            .filter(seg => {
                const segmentEnd = seg.recordedAt + seg.duration;
                // Segment overlaps if: segment_end > requested_start AND segment_start < now
                return segmentEnd > requestedStartTime && seg.recordedAt < now;
            })
            .sort((a, b) => a.recordedAt - b.recordedAt);

        if (relevantSegments.length === 0) {
            Alert.alert('Błąd', 'Brak nagrań z tego okresu. Poczekaj chwilę i spróbuj ponownie.');
            return;
        }

        console.log(`📊 Found ${relevantSegments.length} relevant segments:`);
        relevantSegments.forEach((seg, i) => {
            const start = new Date(seg.recordedAt).toISOString();
            const end = new Date(seg.recordedAt + seg.duration).toISOString();
            console.log(`  ${i + 1}. ${start} → ${end} (${(seg.duration / 1000).toFixed(1)}s)`);
        });

        const highlightId = `highlight_${Date.now()}`;

        try {
            setProcessingState({
                isProcessing: true,
                highlightId,
                progress: 'Przygotowywanie...',
            });

            showToast(`🎬 Przetwarzam ${requestedDuration}s nagrania...`);

            if (!mediaPermission?.granted) {
                const { granted } = await requestMediaPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do zapisywania w galerii');
                    setProcessingState({ isProcessing: false, highlightId: null, progress: '' });
                    return;
                }
            }

            const highlightDir = `${FileSystem.documentDirectory}${RecordingConfig.HIGHLIGHTS_FOLDER}`;
            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            const outputUri = `${highlightDir}${highlightId}.mp4`;

            // 🔥 POPRAWIONA LOGIKA: Użyj NOWEJ funkcji mergePreciseClip
            // która używa re-encoding dla idealnego połączenia bez szarpań

            setProcessingState({
                isProcessing: true,
                highlightId,
                progress: `Łączę ${relevantSegments.length} segmentów...`,
            });

            console.log('🔄 Starting merge with re-encoding for seamless result...');

            try {
                // Użyj NOWEJ funkcji mergePreciseClip zamiast extractPreciseClip
                const mergedPath = await VideoMerger.mergePreciseClip(
                    relevantSegments.map(seg => seg.uri),
                    requestedStartTime,    // Globalny timestamp początku
                    requestedDuration,      // Dokładna długość w sekundach
                    relevantSegments.map(seg => seg.recordedAt), // Timestampy początku każdego segmentu
                    outputUri
                );

                console.log('✅ Merge completed!', mergedPath);

                setProcessingState({
                    isProcessing: true,
                    highlightId,
                    progress: 'Zapisywanie do galerii...',
                });

                const fileInfo = await FileSystem.getInfoAsync(mergedPath);
                if (!fileInfo.exists) {
                    throw new Error('Merged file not created');
                }

                console.log(`📦 Output file size: ${(fileInfo.size / 1024 / 1024).toFixed(2)}MB`);

                // Zapisz do galerii
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
                    timestamp: new Date(),
                    duration: requestedDuration,
                    uri: mergedPath,
                };

                setHighlights((prev) => [newHighlight, ...prev]);

                setProcessingState({
                    isProcessing: false,
                    highlightId: null,
                    progress: '',
                });

                showToast(`✅ Akcja ${requestedDuration}s zapisana w galerii!`);

                Alert.alert(
                    '✅ Gotowe!',
                    `Nagranie ${requestedDuration}s zapisane bez szarpań\n` +
                    `(${relevantSegments.length} segmentów połączonych)`,
                    [{ text: 'OK' }]
                );

                console.log('🎉 Highlight captured successfully!');

                // 🔥 KRYTYCZNE: Wznów nagrywanie jeśli było aktywne
                if (wasRecording) {
                    console.log('▶️ Resuming recording...');
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Restart recording loop
                    const recordSegment = async (): Promise<void> => {
                        if (!isRecordingRef.current || !cameraRef.current) {
                            return;
                        }

                        try {
                            const segmentStartTime = Date.now();
                            const video = await cameraRef.current.recordAsync({
                                maxDuration: RecordingConfig.SEGMENT_DURATION,
                            });

                            if (video && video.uri && isRecordingRef.current) {
                                const segmentEndTime = Date.now();
                                const actualDuration = segmentEndTime - segmentStartTime;

                                const segment: VideoSegment = {
                                    uri: video.uri,
                                    timestamp: segmentEndTime,
                                    recordedAt: segmentStartTime,
                                    duration: actualDuration,
                                };

                                videoSegments.current.push(segment);

                                // Usuń stare segmenty
                                const cutoffTime = Date.now() - (RecordingConfig.BUFFER_DURATION + 10) * 1000;
                                videoSegments.current = videoSegments.current.filter(
                                    seg => seg.recordedAt > cutoffTime
                                );

                                console.log(`📦 Buffer: ${videoSegments.current.length} segments`);

                                await new Promise(resolve => setTimeout(resolve, 100));
                                await recordSegment();
                            }
                        } catch (error) {
                            console.error('Recording error after resume:', error);
                        }
                    };

                    recordSegment();
                }

            } catch (mergeError) {
                console.error('❌ Video merge failed:', mergeError);
                setProcessingState({
                    isProcessing: false,
                    highlightId: null,
                    progress: '',
                });

                Alert.alert(
                    'Błąd łączenia wideo',
                    'Nie udało się połączyć segmentów. Sprawdź logi.'
                );

                // 🔥 Wznów nagrywanie nawet w przypadku błędu
                if (wasRecording && isRecordingRef.current) {
                    console.log('▶️ Resuming recording after error...');
                    // Użyj tej samej logiki co wyżej
                    const recordSegment = async (): Promise<void> => {
                        if (!isRecordingRef.current || !cameraRef.current) return;
                        try {
                            const segmentStartTime = Date.now();
                            const video = await cameraRef.current.recordAsync({
                                maxDuration: RecordingConfig.SEGMENT_DURATION,
                            });
                            if (video && video.uri && isRecordingRef.current) {
                                const segmentEndTime = Date.now();
                                const segment: VideoSegment = {
                                    uri: video.uri,
                                    timestamp: segmentEndTime,
                                    recordedAt: segmentStartTime,
                                    duration: segmentEndTime - segmentStartTime,
                                };
                                videoSegments.current.push(segment);
                                const cutoffTime = Date.now() - (RecordingConfig.BUFFER_DURATION + 10) * 1000;
                                videoSegments.current = videoSegments.current.filter(seg => seg.recordedAt > cutoffTime);
                                await new Promise(resolve => setTimeout(resolve, 100));
                                await recordSegment();
                            }
                        } catch (error) {
                            console.error('Recording error after resume:', error);
                        }
                    };
                    recordSegment();
                }
            }

        } catch (error) {
            console.error('Failed to capture highlight:', error);
            setProcessingState({
                isProcessing: false,
                highlightId: null,
                progress: '',
            });
            Alert.alert('Błąd', `Nie udało się zapisać akcji: ${error}`);

            // 🔥 Wznów nagrywanie nawet w przypadku błędu
            if (wasRecording && isRecordingRef.current) {
                console.log('▶️ Resuming recording after error...');
                const recordSegment = async (): Promise<void> => {
                    if (!isRecordingRef.current || !cameraRef.current) return;
                    try {
                        const segmentStartTime = Date.now();
                        const video = await cameraRef.current.recordAsync({
                            maxDuration: RecordingConfig.SEGMENT_DURATION,
                        });
                        if (video && video.uri && isRecordingRef.current) {
                            const segmentEndTime = Date.now();
                            const segment: VideoSegment = {
                                uri: video.uri,
                                timestamp: segmentEndTime,
                                recordedAt: segmentStartTime,
                                duration: segmentEndTime - segmentStartTime,
                            };
                            videoSegments.current.push(segment);
                            const cutoffTime = Date.now() - (RecordingConfig.BUFFER_DURATION + 10) * 1000;
                            videoSegments.current = videoSegments.current.filter(seg => seg.recordedAt > cutoffTime);
                            await new Promise(resolve => setTimeout(resolve, 100));
                            await recordSegment();
                        }
                    } catch (error) {
                        console.error('Recording error after resume:', error);
                    }
                };
                recordSegment();
            }
        }
    }, [mediaPermission, requestMediaPermission, processingState, showToast]);

    const startAsCamera = useCallback(async () => {
        try {
            if (!cameraPermission?.granted) {
                const { granted } = await requestCameraPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do kamery');
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
                } else if (message.type === 'register') {
                    console.log('✅ Remote registered');
                }
            });

            connectionUnsubscribe.current = FirebaseService.onConnection((connected) => {
                setIsConnected(connected);
                if (connected) {
                    console.log('✅ Pilot connected');
                    Alert.alert('Połączono', 'Pilot został połączony!');
                } else {
                    console.log('❌ Pilot disconnected');
                }
            });

            console.log('✅ Camera mode ready');
            console.log(`🔑 Session ID: ${sessionId}`);

        } catch (error) {
            console.error('Failed to start camera:', error);
            Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery.');
        }
    }, [cameraPermission, requestCameraPermission, captureHighlight]);

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

    const startRecording = useCallback(async () => {
        if (!cameraRef.current) {
            Alert.alert('Błąd', 'Kamera nie jest gotowa');
            return;
        }

        try {
            setIsRecording(true);
            isRecordingRef.current = true;
            videoSegments.current = [];
            recordingStartTime.current = Date.now();

            console.log('🎥 Starting continuous recording...');
            console.log(`📊 Segment duration: ${RecordingConfig.SEGMENT_DURATION}s`);

            await new Promise(resolve => setTimeout(resolve, 500));

            const recordSegment = async (): Promise<void> => {
                if (!isRecordingRef.current || !cameraRef.current) {
                    console.log('⏹️ Recording stopped');
                    return;
                }

                const segmentStartTime = Date.now();
                let retryCount = 0;
                const maxRetries = 3;

                while (retryCount < maxRetries && isRecordingRef.current) {
                    try {
                        console.log(`📹 Recording ${RecordingConfig.SEGMENT_DURATION}s segment...`);

                        const video = await cameraRef.current.recordAsync({
                            maxDuration: RecordingConfig.SEGMENT_DURATION,
                        });

                        if (video && video.uri) {
                            const segmentEndTime = Date.now();
                            const actualDuration = segmentEndTime - segmentStartTime;

                            console.log(`✅ Segment recorded: ${(actualDuration / 1000).toFixed(1)}s`);

                            const segment: VideoSegment = {
                                uri: video.uri,
                                timestamp: segmentEndTime,
                                recordedAt: segmentStartTime,
                                duration: actualDuration,
                            };

                            videoSegments.current.push(segment);

                            // Usuń stare segmenty poza buforem
                            const cutoffTime = Date.now() - (RecordingConfig.BUFFER_DURATION + 10) * 1000;
                            const oldSegments = videoSegments.current.filter(
                                seg => seg.recordedAt <= cutoffTime
                            );

                            for (const oldSeg of oldSegments) {
                                try {
                                    await FileSystem.deleteAsync(oldSeg.uri, { idempotent: true });
                                    console.log('🗑️ Deleted old segment');
                                } catch (e) {
                                    console.warn('Delete error:', e);
                                }
                            }

                            videoSegments.current = videoSegments.current.filter(
                                seg => seg.recordedAt > cutoffTime
                            );

                            const bufferSeconds = (Date.now() - recordingStartTime.current) / 1000;
                            console.log(`📦 Buffer: ${videoSegments.current.length} segments (${bufferSeconds.toFixed(1)}s recorded)`);

                            await new Promise(resolve => setTimeout(resolve, 100));

                            break;
                        }
                    } catch (error) {
                        retryCount++;
                        console.error(`❌ Segment error (${retryCount}/${maxRetries}):`, error);

                        if (retryCount >= maxRetries) {
                            Alert.alert(
                                'Błąd nagrywania',
                                'Nie udało się nagrać segmentu.',
                                [{ text: 'OK', onPress: () => {
                                        setIsRecording(false);
                                        isRecordingRef.current = false;
                                    }}]
                            );
                            return;
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
                    }
                }

                if (isRecordingRef.current) {
                    await recordSegment();
                }
            };

            await recordSegment();

        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Błąd', 'Nie udało się rozpocząć nagrywania');
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    }, []);

    const stopRecording = useCallback(async () => {
        console.log('🛑 Stopping recording...');
        setIsRecording(false);
        isRecordingRef.current = false;

        if (cameraRef.current) {
            try {
                await cameraRef.current.stopRecording();
            } catch (error) {
                console.warn('Stop error:', error);
            }
        }

        console.log(`💾 Keeping ${videoSegments.current.length} segments for potential capture`);

        setTimeout(async () => {
            if (!isRecordingRef.current) {
                for (const segment of videoSegments.current) {
                    try {
                        await FileSystem.deleteAsync(segment.uri, { idempotent: true });
                    } catch (error) {
                        console.warn('Delete error:', error);
                    }
                }
                videoSegments.current = [];
                console.log('🗑️ Cleared all segments');
            }
        }, 30000);

        console.log('✅ Recording stopped');
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

    const setCameraReference = useCallback((ref: CameraView | null) => {
        cameraRef.current = ref;
    }, []);

    return useMemo(() => ({
        isRecording,
        highlights,
        isConnected,
        deviceRole,
        serverAddress,
        processingState,
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