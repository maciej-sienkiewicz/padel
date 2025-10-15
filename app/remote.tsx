import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bluetooth, Clock } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function RemoteScreen() {
    const router = useRouter();

    const {
        isConnected,
        connectToCamera,
        sendCaptureSignal,
        disconnect: contextDisconnect,
    } = useRecording();

    const [connecting, setConnecting] = useState(false);
    const [sending, setSending] = useState(false);

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        contextDisconnect();
        router.back();
    };

    const handleConnect = async () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setConnecting(true);

        try {
            await connectToCamera();
        } catch (error) {
            console.error('Connection error:', error);
            Alert.alert('Błąd', 'Nie udało się połączyć z kamerą przez Bluetooth');
        } finally {
            setConnecting(false);
        }
    };

    const handleCapture = async (minutes: number) => {
        if (!isConnected) {
            Alert.alert('Błąd', 'Nie połączono z kamerą');
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        setSending(true);

        try {
            const seconds = minutes * 60;
            sendCaptureSignal(seconds);

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                '✅ Wysłano!',
                `Sygnał ${minutes} min zapisany`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Błąd', 'Nie udało się wysłać sygnału');
        } finally {
            setSending(false);
        }
    };

    const handleDisconnect = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        contextDisconnect();
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e']}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <View style={styles.iconButton}>
                            <ArrowLeft size={24} color={Colors.text} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Tryb Pilot</Text>
                    <View style={styles.placeholder} />
                </View>

                <View style={styles.content}>
                    <View style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <Bluetooth size={20} color={isConnected ? '#10B981' : Colors.textMuted} />
                            <Text style={styles.statusText}>
                                {isConnected ? 'Połączony przez Bluetooth' : 'Niepołączony'}
                            </Text>
                        </View>
                        {isConnected && (
                            <Text style={styles.statusSubtext}>Gotowy do wysyłania sygnałów</Text>
                        )}
                    </View>

                    {!isConnected && (
                        <View style={styles.connectSection}>
                            <View style={styles.instructionCard}>
                                <Bluetooth size={48} color="#7C3AED" />
                                <Text style={styles.instructionTitle}>Połącz z kamerą</Text>
                                <Text style={styles.instructionText}>
                                    Upewnij się, że telefon z kamerą ma włączoną aplikację w trybie "Kamera"
                                </Text>
                                <Text style={styles.instructionSubtext}>
                                    Połączenie nastąpi automatycznie przez Bluetooth
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.connectButton}
                                onPress={handleConnect}
                                disabled={connecting}
                            >
                                <LinearGradient
                                    colors={['#7C3AED', '#5B21B6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.connectButtonGradient}
                                >
                                    {connecting ? (
                                        <>
                                            <ActivityIndicator color={Colors.text} />
                                            <Text style={styles.connectButtonText}>Szukam kamery...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Bluetooth size={24} color={Colors.text} />
                                            <Text style={styles.connectButtonText}>Połącz przez Bluetooth</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.infoBox}>
                                <Text style={styles.infoText}>
                                    💡 Upewnij się że Bluetooth jest włączony
                                </Text>
                                <Text style={styles.infoText}>
                                    💡 Urządzenia powinny być w zasięgu do 30m
                                </Text>
                            </View>
                        </View>
                    )}

                    {isConnected && (
                        <View style={styles.controlsSection}>
                            <Text style={styles.controlsTitle}>Zapisz najlepsze akcje</Text>

                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={() => handleCapture(2)}
                                disabled={sending}
                            >
                                <LinearGradient
                                    colors={['#3B82F6', '#2563EB']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.captureButtonGradient}
                                >
                                    {sending ? (
                                        <ActivityIndicator color={Colors.text} size="large" />
                                    ) : (
                                        <>
                                            <Clock size={32} color={Colors.text} />
                                            <Text style={styles.captureButtonText}>2 minuty</Text>
                                            <Text style={styles.captureButtonSubtext}>
                                                Zapisz ostatnie 2 minuty
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={() => handleCapture(5)}
                                disabled={sending}
                            >
                                <LinearGradient
                                    colors={['#10B981', '#059669']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.captureButtonGradient}
                                >
                                    {sending ? (
                                        <ActivityIndicator color={Colors.text} size="large" />
                                    ) : (
                                        <>
                                            <Clock size={32} color={Colors.text} />
                                            <Text style={styles.captureButtonText}>5 minut</Text>
                                            <Text style={styles.captureButtonSubtext}>
                                                Zapisz ostatnie 5 minut
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.disconnectButton}
                                onPress={handleDisconnect}
                            >
                                <Text style={styles.disconnectButtonText}>Rozłącz</Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
        paddingBottom: 20,
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
    },
    placeholder: {
        width: 48,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    statusCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    statusSubtext: {
        fontSize: 14,
        color: Colors.textMuted,
        marginTop: 8,
    },
    connectSection: {
        flex: 1,
        justifyContent: 'center',
    },
    instructionCard: {
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    instructionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 16,
        marginBottom: 12,
    },
    instructionText: {
        fontSize: 14,
        color: Colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
    },
    instructionSubtext: {
        fontSize: 12,
        color: Colors.primary,
        textAlign: 'center',
        fontWeight: '600',
    },
    connectButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    connectButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 20,
    },
    connectButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
    },
    infoBox: {
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.2)',
    },
    infoText: {
        fontSize: 13,
        color: Colors.text,
        marginBottom: 8,
        lineHeight: 18,
    },
    controlsSection: {
        flex: 1,
        justifyContent: 'center',
    },
    controlsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 24,
    },
    captureButton: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        marginBottom: 16,
    },
    captureButtonGradient: {
        padding: 32,
        alignItems: 'center',
        gap: 8,
    },
    captureButtonText: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
    },
    captureButtonSubtext: {
        fontSize: 14,
        color: Colors.text,
        opacity: 0.8,
    },
    disconnectButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    disconnectButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
    },
});