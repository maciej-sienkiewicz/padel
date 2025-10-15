import createContextHook from '@/utils/createContextHook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BLEService from '@/services/BLEService';
import type { P2PMessage } from '@/services/BLEService';

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

const BUFFER_DURATION = 300; // 5 minut w sekundach (zwiększone z 2 do 5)
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

    // Załaduj zapisane highlighty przy starcie
    useEffect(() => {
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

    const captureHighlight = useCallback(async (duration: number = 120) => {
        if (!isRecordingRef.current) {
            Alert.alert('Błąd', 'Nagrywanie nie jest aktywne');
            return;
        }

        if (videoSegments.current.length === 0) {
            Alert.alert('Błąd', 'Brak nagrań w buforze');
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

            const highlightId = `highlight_${Date.now()}`;
            const highlightDir = `${FileSystem.documentDirectory}highlights/`;

            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            // Pobierz segmenty z ostatnich X sekund
            const cutoffTime = Date.now() - (duration * 1000);
            const relevantSegments = videoSegments.current.filter(
                seg => seg.timestamp > cutoffTime
            );

            if (relevantSegments.length === 0) {
                Alert.alert('Błąd', 'Brak nagrań z tego okresu');
                return;
            }

            console.log(`Saving ${relevantSegments.length} segments (${duration}s)`);

            // W rzeczywistej implementacji trzeba połączyć segmenty wideo
            // Na razie kopiujemy ostatni segment jako przykład
            const lastSegment = relevantSegments[relevantSegments.length - 1];
            const outputUri = `${highlightDir}${highlightId}.mp4`;

            if (lastSegment && lastSegment.uri) {
                await FileSystem.copyAsync({
                    from: lastSegment.uri,
                    to: outputUri
                });

                // Zapisz do galerii
                const asset = await MediaLibrary.createAssetAsync(outputUri);
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
                    duration: duration,
                    uri: outputUri,
                };

                setHighlights((prev) => [newHighlight, ...prev]);

                Alert.alert(
                    '✅ Sukces!',
                    `Akcja ${duration}s zapisana w galerii`,
                    [{ text: 'OK' }]
                );

                console.log('Highlight captured successfully');
            }
        } catch (error) {
            console.error('Failed to capture highlight:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać akcji');
        }
    }, [mediaPermission, requestMediaPermission]);

    const startAsCamera = useCallback(async () => {
        try {
            // Sprawdź uprawnienia kamery
            if (!cameraPermission?.granted) {
                const { granted } = await requestCameraPermission();
                if (!granted) {
                    Alert.alert('Błąd', 'Brak uprawnień do kamery');
                    return;
                }
            }

            BLEService.setDeviceRole('camera');
            const address = await BLEService.startAsCamera();
            setServerAddress(address);
            setDeviceRole('camera');

            // Nasłuchuj wiadomości od pilotów
            messageUnsubscribe.current = BLEService.onMessage((message: P2PMessage) => {
                console.log('📹 Camera received:', message.type);

                if (message.type === 'capture') {
                    const duration = (message.duration || 120);
                    console.log(`🎬 Capture signal! Duration: ${duration}s`);
                    captureHighlight(duration);
                } else if (message.type === 'register') {
                    console.log('✅ Remote registered');
                }
            });

            // Nasłuchuj połączenia/rozłączenia pilotów
            connectionUnsubscribe.current = BLEService.onConnection((connected) => {
                setIsConnected(connected);
                if (connected) {
                    console.log('✅ Pilot connected via BLE');
                    Alert.alert('Połączono', 'Pilot został połączony przez Bluetooth!');
                } else {
                    console.log('❌ Pilot disconnected');
                }
            });

            console.log('✅ Camera mode ready (BLE)');

        } catch (error) {
            console.error('Failed to start camera:', error);
            Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery');
        }
    }, [cameraPermission, requestCameraPermission, captureHighlight]);

    const connectToCamera = useCallback(async () => {
        try {
            BLEService.setDeviceRole('remote');
            const connected = await BLEService.connectToCamera();

            if (connected) {
                setIsConnected(true);
                setServerAddress('BLE Connected');
                setDeviceRole('remote');

                messageUnsubscribe.current = BLEService.onMessage((message: P2PMessage) => {
                    console.log('🎮 Remote received:', message.type);
                });

                console.log('✅ Connected to camera via BLE');
                Alert.alert('Sukces', 'Połączono z kamerą przez Bluetooth!');
            }
        } catch (error) {
            console.error('Failed to connect:', error);
            setIsConnected(false);
            Alert.alert(
                'Błąd połączenia',
                'Nie udało się połączyć z kamerą przez Bluetooth. Sprawdź czy:\n\n' +
                '1. Kamera ma włączony Bluetooth\n' +
                '2. Aplikacja na kamerze jest uruchomiona\n' +
                '3. Urządzenia są blisko siebie (do 10m)'
            );
        }
    }, []);

    const sendCaptureSignal = useCallback((duration: number = 120) => {
        if (!isConnected) {
            Alert.alert('Błąd', 'Brak połączenia z kamerą');
            return;
        }

        BLEService.sendMessage({
            type: 'capture',
            timestamp: Date.now(),
            duration: duration
        });

        console.log(`📤 Capture signal sent via BLE (${duration}s)`);
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

        BLEService.disconnect();
        setIsConnected(false);
        setDeviceRole(null);

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

            console.log('🎥 Started continuous recording');

            // Funkcja rekurencyjna do nagrywania segmentów
            const recordSegment = async (): Promise<void> => {
                // Sprawdź aktualną wartość z ref (nie z closure)
                if (!isRecordingRef.current || !cameraRef.current) {
                    console.log('Recording stopped or camera lost');
                    return;
                }

                try {
                    // Rozpocznij nagrywanie segmentu
                    const video = await cameraRef.current.recordAsync({
                        maxDuration: SEGMENT_DURATION,
                    });

                    if (video && video.uri) {
                        const segment: VideoSegment = {
                            uri: video.uri,
                            timestamp: Date.now(),
                        };

                        videoSegments.current.push(segment);

                        // Usuń stare segmenty (starsze niż BUFFER_DURATION)
                        const cutoffTime = Date.now() - BUFFER_DURATION * 1000;
                        const oldSegments = videoSegments.current.filter(
                            seg => seg.timestamp <= cutoffTime
                        );

                        // Usuń pliki starych segmentów
                        for (const oldSeg of oldSegments) {
                            try {
                                await FileSystem.deleteAsync(oldSeg.uri, { idempotent: true });
                            } catch (e) {
                                console.warn('Failed to delete old segment:', e);
                            }
                        }

                        // Zachowaj tylko aktualne segmenty
                        videoSegments.current = videoSegments.current.filter(
                            seg => seg.timestamp > cutoffTime
                        );

                        console.log(`📹 Buffer: ${videoSegments.current.length} segments`);
                    }

                    // Kontynuuj nagrywanie następnego segmentu tylko jeśli nadal nagrywamy
                    if (isRecordingRef.current) {
                        await recordSegment();
                    }
                } catch (error) {
                    console.error('Segment recording error:', error);
                    if (isRecordingRef.current) {
                        // Spróbuj ponownie po 1 sekundzie
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        if (isRecordingRef.current) {
                            await recordSegment();
                        }
                    }
                }
            };

            // Rozpocznij pierwszy segment
            await recordSegment();

        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Błąd', 'Nie udało się rozpocząć nagrywania');
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    }, []);

    const stopRecording = useCallback(async () => {
        setIsRecording(false);
        isRecordingRef.current = false;

        if (cameraRef.current) {
            try {
                await cameraRef.current.stopRecording();
            } catch (error) {
                console.warn('Stop recording error:', error);
            }
        }

        // Usuń wszystkie tymczasowe segmenty
        for (const segment of videoSegments.current) {
            try {
                await FileSystem.deleteAsync(segment.uri, { idempotent: true });
            } catch (error) {
                console.warn('Failed to delete segment:', error);
            }
        }

        videoSegments.current = [];
        console.log('🛑 Recording stopped');
    }, []);

    const deleteHighlight = useCallback(async (id: string) => {
        try {
            const highlight = highlights.find(h => h.id === id);
            if (highlight) {
                await FileSystem.deleteAsync(highlight.uri, { idempotent: true });

                // Usuń też z galerii
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
                    console.warn('Failed to delete from gallery:', error);
                }

                setHighlights(prev => prev.filter(h => h.id !== id));
                console.log('Highlight deleted:', id);
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