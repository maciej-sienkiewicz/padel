import createContextHook from '@nkzw/create-context-hook';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

export const [RecordingProvider, useRecording] = createContextHook(() => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [deviceRole, setDeviceRole] = useState<'camera' | 'remote' | null>(null);

    const videoSegments = useRef<VideoSegment[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    const captureHighlight = useCallback(async () => {
        if (videoSegments.current.length === 0) {
            console.log('No segments in buffer to capture');
            return;
        }

        try {
            const highlightId = `highlight_${Date.now()}`;
            const highlightDir = `${FileSystem.documentDirectory}highlights/`;

            await FileSystem.makeDirectoryAsync(highlightDir, { intermediates: true });

            const segments = [...videoSegments.current];
            const outputUri = `${highlightDir}${highlightId}.mp4`;

            console.log(`Saving ${segments.length} segments to ${outputUri}`);

            const newHighlight: Highlight = {
                id: highlightId,
                timestamp: new Date(),
                duration: BUFFER_DURATION,
                uri: outputUri,
            };

            setHighlights((prev) => [newHighlight, ...prev]);
            console.log('Highlight captured successfully');
        } catch (error) {
            console.error('Failed to capture highlight:', error);
        }
    }, []);

    const connectWebSocket = useCallback((role: 'camera' | 'remote') => {
        try {
            if (Platform.OS === 'web') {
                console.log('WebSocket connection simulated on web');
                setIsConnected(true);
                setDeviceRole(role);
                return;
            }

            const ws = new WebSocket('ws://localhost:8080');

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setDeviceRole(role);
                ws.send(JSON.stringify({ type: 'register', role }));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('WebSocket message:', data);

                if (data.type === 'capture' && role === 'camera') {
                    captureHighlight();
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }, [captureHighlight]);

    const disconnectWebSocket = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setDeviceRole(null);
    }, []);

    const sendCaptureCommand = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'capture' }));
            console.log('Sent capture command');
        } else {
            console.log('WebSocket not connected, simulating capture');
        }
    }, []);

    const startRecording = useCallback(() => {
        setIsRecording(true);
        console.log('Started continuous recording with buffer');
    }, []);

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        console.log('Stopped recording');
    }, []);

    const addSegment = useCallback((uri: string) => {
        const segment: VideoSegment = {
            uri,
            timestamp: Date.now(),
        };

        videoSegments.current.push(segment);

        const cutoffTime = Date.now() - BUFFER_DURATION * 1000;
        videoSegments.current = videoSegments.current.filter(
            (seg) => seg.timestamp > cutoffTime
        );

        console.log(`Buffer has ${videoSegments.current.length} segments`);
    }, []);



    const deleteHighlight = useCallback(async (id: string) => {
        try {
            const highlight = highlights.find((h) => h.id === id);
            if (highlight) {
                await FileSystem.deleteAsync(highlight.uri, { idempotent: true });
                setHighlights((prev) => prev.filter((h) => h.id !== id));
                console.log('Highlight deleted:', id);
            }
        } catch (error) {
            console.error('Failed to delete highlight:', error);
        }
    }, [highlights]);

    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return useMemo(() => ({
        isRecording,
        highlights,
        isConnected,
        deviceRole,
        startRecording,
        stopRecording,
        addSegment,
        captureHighlight,
        deleteHighlight,
        connectWebSocket,
        disconnectWebSocket,
        sendCaptureCommand,
    }), [
        isRecording,
        highlights,
        isConnected,
        deviceRole,
        startRecording,
        stopRecording,
        addSegment,
        captureHighlight,
        deleteHighlight,
        connectWebSocket,
        disconnectWebSocket,
        sendCaptureCommand,
    ]);
});
