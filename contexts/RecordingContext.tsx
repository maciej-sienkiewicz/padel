import createContextHook from '@/utils/createContextHook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert } from 'react-native';

// Użyj odpowiedniego serwisu w zależności od platformy
import TCPService from '@/services/TCPService';
import MockP2PService from '@/services/MockP2PService';
import type { P2PMessage } from '@/services/TCPService';
import ServerWebSocketService from "@/services/ServerWebSocketService";

// Wybierz serwis w zależności od platformy
const P2PService = ServerWebSocketService;

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

const BUFFER_DURATION = 120;
const SEGMENT_DURATION = 10;

export const [RecordingProvider, useRecording] = createContextHook(() => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [deviceRole, setDeviceRole] = useState<'camera' | 'remote' | null>(null);
    const [serverAddress, setServerAddress] = useState<string>('');
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

    const videoSegments = useRef<VideoSegment[]>([]);
    const recordingInterval = useRef<any>(null);
    const messageUnsubscribe = useRef<(() => void) | null>(null);

    const getDocumentDirectory = useCallback(() => {
        return FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    }, []);

    useEffect(() => {
        loadHighlights();
    }, []);

    const loadHighlights = useCallback(async () => {
        try {
            const docDir = getDocumentDirectory();
            const highlightDir = `${docDir}highlights/`;
            const dirInfo = await FileSystem.getInfoAsync(highlightDir);

            if (dirInfo.exists) {
                const files = await FileSystem.readDirectoryAsync(highlightDir);
                const loadedHighlights = files.map(filename => {
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
    }, [getDocumentDirectory]);

    const captureHighlight = useCallback(async () => {
        if (videoSegments.current.length === 0) {
            console.log('No segments in buffer to capture');
            Alert.alert('Błąd', 'Brak nagrań w buforze. Rozpocznij nagrywanie.');
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
            const docDir = getDocumentDirectory();
            const highlightDir = `${docDir}highlights/`;

            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            const segments = [...videoSegments.current];
            const outputUri = `${highlightDir}${highlightId}.mp4`;

            console.log(`Saving ${segments.length} segments to ${outputUri}`);

            await FileSystem.writeAsStringAsync(outputUri, 'video_placeholder');

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
                duration: BUFFER_DURATION,
                uri: outputUri,
            };

            setHighlights((prev) => [newHighlight, ...prev]);

            Alert.alert(
                'Sukces!',
                'Akcja została zapisana w galerii',
                [{ text: 'OK' }]
            );

            console.log('Highlight captured and saved to gallery');
        } catch (error) {
            console.error('Failed to capture highlight:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać akcji');
        }
    }, [mediaPermission, requestMediaPermission, getDocumentDirectory]);

    const startAsCamera = useCallback(async () => {
        try {
            P2PService.setDeviceRole('camera'); // Ustaw rolę PRZED połączeniem
            const address = await P2PService.startServer();
            setServerAddress(address);
            setDeviceRole('camera');

            messageUnsubscribe.current = P2PService.onMessage((message: P2PMessage) => {
                console.log('Camera received message:', message);

                if (message.type === 'capture') {
                    console.log('Capture signal received from remote');
                    captureHighlight();
                } else if (message.type === 'register' && message.role === 'remote') {
                    setIsConnected(true);
                    console.log('Remote connected');
                }
            });

            console.log('Camera mode - ready to connect to server');
        } catch (error) {
            console.error('Failed to start camera:', error);
            Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery');
        }
    }, [captureHighlight]);

    const connectToCamera = useCallback(async (address: string) => {
        try {
            P2PService.setDeviceRole('remote'); // Ustaw rolę PRZED połączeniem
            const connected = await P2PService.connectToServer(address);

            if (connected) {
                setDeviceRole('remote');
                setIsConnected(true);
                setServerAddress(address);

                messageUnsubscribe.current = P2PService.onMessage((message: P2PMessage) => {
                    console.log('Remote received message:', message);

                    if (message.type === 'register' && message.role === 'camera') {
                        setIsConnected(true);
                    }
                });

                Alert.alert('Sukces', 'Połączono z serwerem!');
            }
        } catch (error) {
            console.error('Failed to connect to server:', error);
            setIsConnected(false);
            Alert.alert('Błąd', 'Nie udało się połączyć z serwerem');
        }
    }, []);

    const sendCaptureSignal = useCallback(() => {
        if (!isConnected) {
            Alert.alert('Błąd', 'Brak połączenia z kamerą');
            return;
        }

        P2PService.sendMessage({
            type: 'capture',
            timestamp: Date.now(),
        });

        const platformMsg = Platform.OS === 'web' ? ' (wersja testowa)' : '';
        console.log('Sent capture signal to camera');
        Alert.alert('Wysłano', `Sygnał nagrywania został wysłany!${platformMsg}`);
    }, [isConnected]);

    const disconnect = useCallback(() => {
        if (messageUnsubscribe.current) {
            messageUnsubscribe.current();
            messageUnsubscribe.current = null;
        }

        P2PService.disconnect();
        setIsConnected(false);
        setDeviceRole(null);
        setServerAddress('');

        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
    }, []);

    const startRecording = useCallback(() => {
        setIsRecording(true);

        const docDir = getDocumentDirectory();

        recordingInterval.current = setInterval(() => {
            const segment: VideoSegment = {
                uri: `${docDir}temp_${Date.now()}.mp4`,
                timestamp: Date.now(),
            };

            videoSegments.current.push(segment);

            const cutoffTime = Date.now() - BUFFER_DURATION * 1000;
            videoSegments.current = videoSegments.current.filter(
                seg => seg.timestamp > cutoffTime
            );

            console.log(`Buffer: ${videoSegments.current.length} segments`);
        }, SEGMENT_DURATION * 1000);

        console.log('Started continuous recording');
    }, [getDocumentDirectory]);

    const stopRecording = useCallback(() => {
        setIsRecording(false);

        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }

        console.log('Stopped recording');
    }, []);

    const deleteHighlight = useCallback(async (id: string) => {
        try {
            const highlight = highlights.find(h => h.id === id);
            if (highlight) {
                await FileSystem.deleteAsync(highlight.uri, { idempotent: true });
                setHighlights(prev => prev.filter(h => h.id !== id));
                console.log('Highlight deleted:', id);
            }
        } catch (error) {
            console.error('Failed to delete highlight:', error);
        }
    }, [highlights]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

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
    ]);
});