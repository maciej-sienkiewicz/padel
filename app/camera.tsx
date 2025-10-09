import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ArrowLeft, Circle, Wifi, Save } from 'lucide-react-native';
import React, { useRef, useEffect } from 'react';
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

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function CameraScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const {
        isRecording,
        isConnected,
        startRecording,
        stopRecording,
        serverAddress,
        highlights,
    } = useRecording();
    const pulseAnim = useRef(new Animated.Value(1)).current;

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
        if (!isConnected) {
            Alert.alert(
                'Brak połączenia',
                'Połącz najpierw pilota przed rozpoczęciem nagrywania',
                [{ text: 'OK' }]
            );
            return;
        }

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

    if (!permission) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[Colors.background, Colors.backgroundLight]}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[Colors.background, Colors.backgroundLight]}
                    style={StyleSheet.absoluteFillObject}
                />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.permissionContainer}>
                        <Text style={styles.permissionTitle}>Dostęp do kamery</Text>
                        <Text style={styles.permissionText}>
                            Potrzebujemy dostępu do kamery, aby nagrywać akcje
                        </Text>
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={requestPermission}
                        >
                            <LinearGradient
                                colors={[Colors.primary, Colors.primaryDark]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.permissionButtonGradient}
                            >
                                <Text style={styles.permissionButtonText}>Zezwól</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} facing={'back' as CameraType}>
                <LinearGradient
                    colors={['rgba(10, 14, 39, 0.8)', 'transparent', 'rgba(10, 14, 39, 0.9)']}
                    style={StyleSheet.absoluteFillObject}
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

                    <View style={styles.centerContent}>
                        {isRecording && (
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

                        {!isConnected && !isRecording && (
                            <View style={styles.warningContainer}>
                                <Text style={styles.warningText}>
                                    Oczekiwanie na połączenie z pilotem...
                                </Text>
                                <Text style={styles.warningSubtext}>
                                    Adres: {serverAddress}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        {!isRecording ? (
                            <TouchableOpacity
                                style={[
                                    styles.recordButton,
                                    !isConnected && styles.recordButtonDisabled,
                                ]}
                                onPress={handleStartRecording}
                                disabled={!isConnected}
                            >
                                <LinearGradient
                                    colors={
                                        isConnected
                                            ? [Colors.primary, Colors.primaryDark]
                                            : [Colors.textMuted, Colors.backgroundLight]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.recordButtonGradient}
                                >
                                    <Circle size={32} color={Colors.text} strokeWidth={3} />
                                    <Text style={styles.recordButtonText}>Rozpocznij nagrywanie</Text>
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
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    camera: {
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
        backgroundColor: 'rgba(255, 184, 0, 0.2)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: Colors.warning,
        alignItems: 'center',
    },
    warningText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    warningSubtext: {
        color: Colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    recordButtonDisabled: {
        opacity: 0.6,
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
    permissionButton: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
    },
    permissionButtonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    permissionButtonText: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
});