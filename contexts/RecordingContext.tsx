import createContextHook from '@/utils/createContextHook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import FirebaseService from '@/services/FirebaseService';
import { firebaseConfig } from '@/config/firebase';
import type { P2PMessage } from '@/services/FirebaseService';
import VideoMerger from '@/modules/VideoMerger';

interface VideoSegment {
    uri: string;
    timestamp: number;
}

interface Highlight {
    id: string;
    timestamp: Date;
    duration: number;
    uri: string;
}

const BUFFER_DURATION = 300; // 5 minut w sekundach
const SEGMENT_DURATION = 10; // 10 sekund na segment

export const [RecordingProvider, useRecording] = createContextHook(() => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [deviceRole, setDeviceRole] = useState<'camera' | 'remote' | null>(null);
    const [serverAddress, setServerAddress] = useState<string>('');
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    const videoSegments = useRef<VideoSegment[]>([]);
    const cameraRef = useRef<CameraView | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const messageUnsubscribe = useRef<(() => void) | null>(null);
    const connectionUnsubscribe = useRef<(() => void) | null>(null);

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
            const highlightDir = `${FileSystem.documentDirectory}highlights/`;
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
                            duration: BUFFER_DURATION,
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
     * 🎯 CAPTURE HIGHLIGHT - Native Module Video Merging
     */
    const captureHighlight = useCallback(async (requestedDuration: number = 120) => {
        console.log('🎬 Capture highlight requested:', requestedDuration);

        if (!isRecordingRef.current) {
            Alert.alert('Błąd', 'Nagrywanie nie jest aktywne');
            return;
        }

        // Pobierz segmenty z ostatnich X sekund
        const cutoffTime = Date.now() - (requestedDuration * 1000);
        const relevantSegments = videoSegments.current
            .filter(seg => seg.timestamp > cutoffTime)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (relevantSegments.length === 0) {
            Alert.alert('Błąd', 'Brak nagrań z tego okresu. Poczekaj chwilę.');
            return;
        }

        try {
            if (!mediaPermission?.granted) {
                const { granted } = await requestMediaPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do zapisywania w galerii');
                    return;
                }
            }

            console.log(`🎬 Łączenie ${relevantSegments.length} segmentów (${requestedDuration}s)...`);

            const highlightId = `highlight_${Date.now()}`;
            const highlightDir = `${FileSystem.documentDirectory}highlights/`;
            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            const outputUri = `${highlightDir}${highlightId}.mp4`;

            // Przygotuj ścieżki do segmentów
            const videoPaths = relevantSegments.map(seg => seg.uri);

            console.log('📹 Video paths:', videoPaths);
            console.log('📁 Output path:', outputUri);

            // ✨ UŻYJ NATYWNEGO MODUŁU!
            try {
                const mergedPath = await VideoMerger.mergeVideos(videoPaths, outputUri);
                console.log('✅ Segmenty połączone!', mergedPath);

                const fileInfo = await FileSystem.getInfoAsync(mergedPath);
                if (!fileInfo.exists) {
                    throw new Error('Merged file not created');
                }

                console.log(`📦 Output file size: ${fileInfo.size} bytes`);

                // Zapisz do galerii
                const asset = await MediaLibrary.createAssetAsync(mergedPath);
                const albums = await MediaLibrary.getAlbumsAsync();
                const existingAlbum = albums.find(album => album.title === 'Padel Highlights');

                if (existingAlbum) {
                    await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
                } else {
                    await MediaLibrary.createAlbumAsync('Padel Highlights', asset, false);
                }

                const newHighlight: Highlight = {
                    id: highlightId,
                    timestamp: new Date(),
                    duration: requestedDuration,
                    uri: mergedPath,
                };

                setHighlights((prev) => [newHighlight, ...prev]);

                Alert.alert(
                    '✅ Sukces!',
                    `Akcja ${requestedDuration}s (${relevantSegments.length} segmentów) zapisana w galerii`,
                    [{ text: 'OK' }]
                );

                console.log('🎉 Highlight captured successfully!');

            } catch (mergeError) {
                console.error('❌ Video merge failed:', mergeError);
                Alert.alert(
                    'Błąd łączenia wideo',
                    'Nie udało się połączyć segmentów. Sprawdź logi.'
                );
            }

        } catch (error) {
            console.error('Failed to capture highlight:', error);
            Alert.alert('Błąd', `Nie udało się zapisać akcji: ${error}`);
        }
    }, [mediaPermission, requestMediaPermission]);

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

            console.log('🎥 Starting continuous recording...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            const recordSegment = async (): Promise<void> => {
                if (!isRecordingRef.current || !cameraRef.current) {
                    console.log('⏹️ Recording stopped');
                    return;
                }

                let retryCount = 0;
                const maxRetries = 5;

                while (retryCount < maxRetries && isRecordingRef.current) {
                    try {
                        console.log(`📹 Recording ${SEGMENT_DURATION}s segment...`);

                        const video = await cameraRef.current.recordAsync({
                            maxDuration: SEGMENT_DURATION,
                        });

                        if (video && video.uri) {
                            console.log('✅ Segment recorded');

                            const segment: VideoSegment = {
                                uri: video.uri,
                                timestamp: Date.now(),
                            };

                            videoSegments.current.push(segment);

                            // Usuń stare segmenty poza buforem
                            const cutoffTime = Date.now() - BUFFER_DURATION * 1000;
                            const oldSegments = videoSegments.current.filter(
                                seg => seg.timestamp <= cutoffTime
                            );

                            for (const oldSeg of oldSegments) {
                                try {
                                    await FileSystem.deleteAsync(oldSeg.uri, { idempotent: true });
                                } catch (e) {
                                    console.warn('Delete error:', e);
                                }
                            }

                            videoSegments.current = videoSegments.current.filter(
                                seg => seg.timestamp > cutoffTime
                            );

                            console.log(`📦 Buffer: ${videoSegments.current.length} segments`);
                            await new Promise(resolve => setTimeout(resolve, 1500));

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

                        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
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

        for (const segment of videoSegments.current) {
            try {
                await FileSystem.deleteAsync(segment.uri, { idempotent: true });
            } catch (error) {
                console.warn('Delete error:', error);
            }
        }

        videoSegments.current = [];
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
                        album: 'Padel Highlights',
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