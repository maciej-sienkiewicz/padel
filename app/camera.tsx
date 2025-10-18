import { useRouter } from 'expo-router';
import { ArrowLeft, Circle, Wifi, Save, Loader } from 'lucide-react-native';
import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Animated,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'react-native-vision-camera';

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function CameraScreen() {
    const router = useRouter();
    const {
        isRecording,
        isConnected,
        startRecording,
        stopRecording,
        serverAddress,
        highlights,
        processingState,
        device,
        setCameraReference,
        startAsCamera,
        disconnect,
    } = useRecording();

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const cameraRef = useRef<Camera>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);

    useEffect(() => {
        if (cameraRef.current) {
            setCameraReference(cameraRef.current);
        }
    }, [setCameraReference]);

    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording, pulseAnim]);

    useEffect(() => {
        if (processingState.isProcessing) {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            spinAnim.setValue(0);
        }
    }, [processingState.isProcessing, spinAnim]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    useEffect(() => {
        console.log('📹 Camera screen mounted, starting camera mode...');

        const initCamera = async () => {
            try {
                await startAsCamera();
                console.log('✅ Camera mode started');
            } catch (error) {
                console.error('❌ Failed to start camera:', error);
                Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery.');
            }
        };

        initCamera();

        return () => {
            console.log('👋 Camera screen unmounting');
            disconnect();
        };
    }, [startAsCamera, disconnect]);

    const handleBack = () => {
        if (isRecording) {
            Alert.alert(
                'Zatrzymać nagrywanie?',
                'Czy na pewno chcesz wrócić? Nagrywanie zostanie zatrzymane.',
                [
                    { text: 'Anuluj', style: 'cancel' },
                    {
                        text: 'Zatrzymaj',
                        style: 'destructive',
                        onPress: () => {
                            stopRecording();
                            router.back();
                        },
                    },
                ]
            );
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    };

    const handleStartRecording = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        startRecording();
    };

    const handleStopRecording = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        stopRecording();
    };

    const handleViewHighlights = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.push('/highlights');
    };

    // Check if camera is available
    if (!device) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[Colors.background, Colors.backgroundLight]}
                    style={StyleSheet.absoluteFillObject}
                />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.permissionContainer}>
                        <Text style={styles.permissionTitle}>Kamera niedostępna</Text>
                        <Text style={styles.permissionText}>
                            Nie znaleziono urządzenia kamery
                        </Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={true}
                video={true}
                audio={true}
                onInitialized={() => {
                    console.log('📸 Camera initialized');
                    setIsCameraReady(true);
                }}
                onError={(error) => {
                    console.error('❌ Camera error:', error);
                    Alert.alert('Błąd kamery', error.message);
                }}
            />

            {/* UI OVERLAY - poza Camera component! */}
            <View style={styles.overlay}>
                <LinearGradient
                    colors={['rgba(10, 14, 39, 0.6)', 'transparent', 'rgba(10, 14, 39, 0.8)']}
                    style={StyleSheet.absoluteFillObject}
                    pointerEvents="none"
                />

                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
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
                                    { backgroundColor: isConnected ? Colors.success : Colors.warning },
                                ]}
                            />
                            <Text style={styles.statusText}>
                                {isConnected ? 'Pilot OK' : 'Bez pilota'}
                            </Text>
                            <Wifi
                                size={20}
                                color={isConnected ? Colors.success : Colors.warning}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.highlightsButton}
                            onPress={handleViewHighlights}
                        >
                            <View style={styles.iconButton}>
                                <Save size={24} color={Colors.text} />
                                {highlights.length > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{highlights.length}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Center Content */}
                    <View style={styles.centerContent}>
                        {processingState.isProcessing && (
                            <View style={styles.processingContainer}>
                                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                                    <Loader size={32} color={Colors.primary} />
                                </Animated.View>
                                <Text style={styles.processingTitle}>Przetwarzanie...</Text>
                                <Text style={styles.processingText}>
                                    {processingState.progress}
                                </Text>
                                <Text style={styles.processingSubtext}>
                                    Możesz kontynuować nagrywanie
                                </Text>
                            </View>
                        )}

                        {isRecording && !processingState.isProcessing && (
                            <Animated.View
                                style={[
                                    styles.recordingIndicator,
                                    { transform: [{ scale: pulseAnim }] },
                                ]}
                            >
                                <Circle size={16} color={Colors.accent} fill={Colors.accent} />
                                <Text style={styles.recordingText}>NAGRYWANIE</Text>
                            </Animated.View>
                        )}

                        {!isRecording && !processingState.isProcessing && (
                            <View style={styles.warningContainer}>
                                <Text style={styles.warningText}>
                                    {isConnected ? 'Gotowy do nagrywania' : 'Oczekiwanie na pilota'}
                                </Text>
                                {serverAddress ? (
                                    <>
                                        <Text style={styles.sessionLabel}>Kod sesji:</Text>
                                        <View style={styles.sessionCodeContainer}>
                                            <Text style={styles.sessionCode}>{serverAddress}</Text>
                                        </View>
                                        <Text style={styles.sessionHint}>
                                            Wpisz ten kod w aplikacji na pilocie
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={styles.warningSubtext}>
                                        Generowanie kodu sesji...
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {!isRecording ? (
                            <TouchableOpacity
                                style={styles.recordButton}
                                onPress={handleStartRecording}
                                disabled={!isCameraReady}
                            >
                                <LinearGradient
                                    colors={isCameraReady ? [Colors.primary, Colors.primaryDark] : ['#666', '#444']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.recordButtonGradient}
                                >
                                    <Circle size={32} color={Colors.text} strokeWidth={3} />
                                    <Text style={styles.recordButtonText}>
                                        {isCameraReady ? 'Rozpocznij nagrywanie' : 'Przygotowanie...'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.stopButton}
                                onPress={handleStopRecording}
                            >
                                <View style={styles.stopButtonInner}>
                                    <View style={styles.stopIcon} />
                                    <Text style={styles.stopButtonText}>Zatrzymaj</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    camera: {
        ...StyleSheet.absoluteFillObject, // Kamera wypełnia cały ekran
    },
    overlay: {
        ...StyleSheet.absoluteFillObject, // Overlay na górze kamery
        zIndex: 1,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between', // WAŻNE: rozdziela header, center, footer
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
    highlightsButton: {
        zIndex: 10,
        position: 'relative',
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: Colors.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: Colors.text,
        fontSize: 12,
        fontWeight: '700',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
        fontWeight: '600',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    processingContainer: {
        backgroundColor: 'rgba(0, 217, 255, 0.2)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: Colors.primary,
        alignItems: 'center',
        minWidth: '80%',
        gap: 8,
    },
    processingTitle: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginTop: 8,
    },
    processingText: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.9,
    },
    processingSubtext: {
        color: Colors.textMuted,
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 4,
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 59, 92, 0.2)',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 32,
        gap: 12,
        borderWidth: 2,
        borderColor: Colors.accent,
    },
    recordingText: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 2,
    },
    warningContainer: {
        backgroundColor: 'rgba(0, 217, 255, 0.2)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: Colors.primary,
        alignItems: 'center',
        minWidth: '80%',
    },
    warningText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
    },
    warningSubtext: {
        color: Colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
    },
    sessionLabel: {
        color: Colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    sessionCodeContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    sessionCode: {
        color: Colors.text,
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 4,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    sessionHint: {
        color: Colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    recordButton: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
    },
    recordButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 12,
    },
    recordButtonText: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: '700',
    },
    stopButton: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 2,
        borderColor: Colors.accent,
    },
    stopButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 12,
    },
    stopIcon: {
        width: 24,
        height: 24,
        backgroundColor: Colors.accent,
        borderRadius: 4,
    },
    stopButtonText: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: '700',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    permissionTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    permissionText: {
        fontSize: 16,
        color: Colors.textMuted,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
});