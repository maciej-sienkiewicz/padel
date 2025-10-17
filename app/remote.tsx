import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wifi, Clock } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Alert,
    ActivityIndicator,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import RecordingConfig from '@/constants/recording';
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
    const [sessionId, setSessionId] = useState('');

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        contextDisconnect();
        router.back();
    };

    const handleConnect = async () => {
        if (sessionId.length !== 6) {
            Alert.alert('Błąd', 'Wpisz 6-znakowy kod sesji');
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setConnecting(true);

        try {
            await connectToCamera(sessionId);
        } catch (error) {
            console.error('Connection error:', error);
            Alert.alert('Błąd', 'Nie udało się połączyć. Sprawdź kod sesji i połączenie z internetem.');
        } finally {
            setConnecting(false);
        }
    };

    const handleCapture = async (seconds: number, label: string) => {
        if (!isConnected) {
            Alert.alert('Błąd', 'Nie połączono z kamerą');
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        setSending(true);

        try {
            sendCaptureSignal(seconds);

            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            Alert.alert(
                '✅ Wysłano!',
                `Sygnał "${label}" wysłany do kamery`,
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
        setSessionId('');
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

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <Wifi size={20} color={isConnected ? '#10B981' : Colors.textMuted} />
                            <Text style={styles.statusText}>
                                {isConnected ? 'Połączony z kamerą' : 'Niepołączony'}
                            </Text>
                        </View>
                        {isConnected && (
                            <Text style={styles.statusSubtext}>Gotowy do wysyłania sygnałów</Text>
                        )}
                    </View>

                    {!isConnected && (
                        <View style={styles.connectSection}>
                            <View style={styles.instructionCard}>
                                <Text style={styles.instructionTitle}>Wpisz kod sesji</Text>
                                <Text style={styles.instructionText}>
                                    6-znakowy kod wyświetlony na telefonie z kamerą
                                </Text>
                                <Text style={styles.instructionSubtext}>
                                    Przykład: ABC123
                                </Text>
                            </View>

                            <TextInput
                                style={styles.sessionInput}
                                placeholder="ABC123"
                                placeholderTextColor={Colors.textMuted}
                                value={sessionId}
                                onChangeText={(text) => setSessionId(text.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={6}
                                autoCorrect={false}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.connectButton,
                                    (connecting || sessionId.length !== 6) && styles.connectButtonDisabled
                                ]}
                                onPress={handleConnect}
                                disabled={connecting || sessionId.length !== 6}
                            >
                                <LinearGradient
                                    colors={
                                        connecting || sessionId.length !== 6
                                            ? ['#666', '#444']
                                            : ['#7C3AED', '#5B21B6']
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.connectButtonGradient}
                                >
                                    {connecting ? (
                                        <>
                                            <ActivityIndicator color={Colors.text} />
                                            <Text style={styles.connectButtonText}>Łączę...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Wifi size={24} color={Colors.text} />
                                            <Text style={styles.connectButtonText}>
                                                {sessionId.length === 6 ? 'Połącz' : 'Wpisz kod'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.infoBox}>
                                <Text style={styles.infoText}>
                                    💡 Upewnij się że oba telefony mają internet
                                </Text>
                                <Text style={styles.infoText}>
                                    💡 Kod jest ważny przez całą sesję nagrywania
                                </Text>
                            </View>
                        </View>
                    )}

                    {isConnected && (
                        <View style={styles.controlsSection}>
                            <Text style={styles.controlsTitle}>Zapisz najlepsze akcje</Text>

                            {/* Dynamicznie generowane przyciski z konfiguracji */}
                            {RecordingConfig.CAPTURE_DURATIONS.map((duration, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.captureButton}
                                    onPress={() => handleCapture(duration.seconds, duration.label)}
                                    disabled={sending}
                                >
                                    <LinearGradient
                                        colors={duration.color}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.captureButtonGradient}
                                    >
                                        {sending ? (
                                            <ActivityIndicator color={Colors.text} size="large" />
                                        ) : (
                                            <>
                                                <Clock size={32} color={Colors.text} />
                                                <Text style={styles.captureButtonText}>
                                                    {duration.label}
                                                </Text>
                                                <Text style={styles.captureButtonSubtext}>
                                                    Zapisz ostatnie {duration.label}
                                                </Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={styles.disconnectButton}
                                onPress={handleDisconnect}
                            >
                                <Text style={styles.disconnectButtonText}>Rozłącz</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
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
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
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
    sessionInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
        textAlign: 'center',
        letterSpacing: 4,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    connectButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    connectButtonDisabled: {
        opacity: 0.5,
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
        paddingTop: 20,
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