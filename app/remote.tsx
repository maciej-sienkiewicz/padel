import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wifi, List, Zap } from 'lucide-react-native';
import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function RemoteScreen() {
    const router = useRouter();
    const { isConnected, highlights, sendCaptureCommand, connectWebSocket, disconnectWebSocket } = useRecording();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const flashAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        connectWebSocket('remote');
        return () => {
            disconnectWebSocket();
        };
    }, [connectWebSocket, disconnectWebSocket]);

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    };

    const handleCapture = () => {
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        Animated.sequence([
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(flashAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 3,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(flashAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

        sendCaptureCommand();
    };

    const handleViewHighlights = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push('/highlights');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.background, Colors.backgroundLight]}
                style={StyleSheet.absoluteFillObject}
            />
            <Animated.View
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        backgroundColor: Colors.accent,
                        opacity: flashAnim,
                    },
                ]}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <View style={styles.iconButton}>
                            <ArrowLeft size={24} color={Colors.text} />
                        </View>
                    </TouchableOpacity>

                    <View style={styles.statusContainer}>
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: isConnected ? Colors.success : Colors.textMuted },
                            ]}
                        />
                        <Text style={styles.statusText}>
                            {isConnected ? 'Połączono' : 'Oczekiwanie'}
                        </Text>
                        <Wifi
                            size={20}
                            color={isConnected ? Colors.success : Colors.textMuted}
                        />
                    </View>
                </View>

                <View style={styles.content}>
                    <View style={styles.infoSection}>
                        <Text style={styles.title}>Pilot nagrywania</Text>
                        <Text style={styles.subtitle}>
                            Naciśnij przycisk, gdy wydarzy się ciekawa akcja
                        </Text>

                        <View style={styles.statsContainer}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{highlights.length}</Text>
                                <Text style={styles.statLabel}>Zapisanych akcji</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.captureSection}>
                        <Animated.View
                            style={[
                                styles.captureButtonWrapper,
                                { transform: [{ scale: scaleAnim }] },
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={handleCapture}
                                disabled={!isConnected}
                                style={styles.captureButton}
                            >
                                <LinearGradient
                                    colors={
                                        isConnected
                                            ? [Colors.accent, '#FF1744']
                                            : [Colors.textMuted, Colors.backgroundLight]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.captureButtonGradient}
                                >
                                    <View style={styles.captureIconContainer}>
                                        <Zap size={64} color={Colors.text} fill={Colors.text} />
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                        <Text style={styles.captureHint}>
                            {isConnected ? 'Naciśnij, aby zapisać akcję' : 'Oczekiwanie na połączenie'}
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.highlightsButton}
                            onPress={handleViewHighlights}
                        >
                            <View style={styles.highlightsButtonInner}>
                                <List size={24} color={Colors.primary} />
                                <Text style={styles.highlightsButtonText}>
                                    Zobacz zapisane akcje
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    backButton: {
        zIndex: 10,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600' as const,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'space-between',
        paddingTop: 40,
        paddingBottom: 20,
    },
    infoSection: {
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '800' as const,
        color: Colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    statsContainer: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statBox: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 48,
        fontWeight: '800' as const,
        color: Colors.primary,
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 16,
        color: Colors.textMuted,
        fontWeight: '600' as const,
    },
    captureSection: {
        alignItems: 'center',
        gap: 24,
    },
    captureButtonWrapper: {
        width: 200,
        height: 200,
    },
    captureButton: {
        width: '100%',
        height: '100%',
        borderRadius: 100,
        overflow: 'hidden',
        elevation: 16,
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
    },
    captureButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureIconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureHint: {
        fontSize: 18,
        color: Colors.textMuted,
        fontWeight: '600' as const,
        textAlign: 'center',
    },
    footer: {
        width: '100%',
    },
    highlightsButton: {
        width: '100%',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: Colors.primary,
        overflow: 'hidden',
    },
    highlightsButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 12,
    },
    highlightsButtonText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '700' as const,
    },
});
