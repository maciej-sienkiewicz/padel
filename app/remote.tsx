import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wifi, Camera as CameraIcon, Clock } from 'lucide-react-native';
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
import { CameraView, useCameraPermissions } from 'expo-camera';

import Colors from '@/constants/colors';
import RemotePilotService from '@/services/RemotePilotService';

export default function RemoteScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();

    const [scanning, setScanning] = useState(false);
    const [connected, setConnected] = useState(false);
    const [cameraIP, setCameraIP] = useState('');
    const [pilotID, setPilotID] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        // Generuj pilot ID
        const id = RemotePilotService.getPilotID();
        setPilotID(id);

        return () => {
            RemotePilotService.disconnect();
        };
    }, []);

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        RemotePilotService.disconnect();
        router.back();
    };

    const handleStartScanning = async () => {
        if (!permission) {
            await requestPermission();
            return;
        }

        if (!permission.granted) {
            Alert.alert('Brak uprawnień', 'Potrzebujemy dostępu do kamery aby zeskanować QR kod');
            await requestPermission();
            return;
        }

        setScanning(true);
    };

    const handleQRScanned = async ({ data }: { data: string }) => {
        if (connected || sending) return;

        console.log('QR scanned:', data);

        // Parse QR data (format: "SSID:password:serverIP")
        const parts = data.split(':');
        if (parts.length < 3) {
            Alert.alert('Błąd', 'Nieprawidłowy kod QR');
            return;
        }

        const serverIP = parts[2];
        console.log('Server IP:', serverIP);

        setScanning(false);
        setSending(true);

        try {
            const success = await RemotePilotService.connectToServer(serverIP);

            if (success) {
                setConnected(true);
                setCameraIP(serverIP);

                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }

                Alert.alert(
                    'Połączono!',
                    `Pilot ${pilotID} połączony z kamerą`,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Błąd', 'Nie udało się połączyć z kamerą');
            }
        } catch (error) {
            console.error('Connection error:', error);
            Alert.alert('Błąd', 'Nie udało się połączyć z kamerą');
        } finally {
            setSending(false);
        }
    };

    const handleCapture = async (minutes: number) => {
        if (!connected) {
            Alert.alert('Błąd', 'Nie połączono z kamerą');
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        setSending(true);

        try {
            const success = await RemotePilotService.sendCapture(minutes);

            if (success) {
                if (Platform.OS !== 'web') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }

                Alert.alert(
                    'Wysłano!',
                    `Sygnał ${minutes} min zapisany`,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Błąd', 'Nie udało się wysłać sygnału');
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert('Błąd', 'Nie udało się wysłać sygnału');
        } finally {
            setSending(false);
        }
    };

    const handleDisconnect = () => {
        RemotePilotService.disconnect();
        setConnected(false);
        setCameraIP('');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e']}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
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
                    {/* Status Card */}
                    <View style={styles.statusCard}>
                        <View style={styles.statusRow}>
                            <Wifi size={20} color={connected ? '#10B981' : Colors.textMuted} />
                            <Text style={styles.statusText}>
                                {connected ? 'Połączony' : 'Niepołączony'}
                            </Text>
                        </View>
                        {connected && (
                            <Text style={styles.statusSubtext}>Kamera: {cameraIP}</Text>
                        )}
                        <Text style={styles.pilotIDText}>ID: {pilotID}</Text>
                    </View>

                    {!connected && !scanning && (
                        <View style={styles.scanSection}>
                            <View style={styles.instructionCard}>
                                <CameraIcon size={48} color="#7C3AED" />
                                <Text style={styles.instructionTitle}>Zeskanuj QR kod</Text>
                                <Text style={styles.instructionText}>
                                    Wyświetl kod QR na telefonie z kamerą i zeskanuj go poniższym przyciskiem
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.scanButton}
                                onPress={handleStartScanning}
                                disabled={sending}
                            >
                                <LinearGradient
                                    colors={['#7C3AED', '#5B21B6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.scanButtonGradient}
                                >
                                    {sending ? (
                                        <ActivityIndicator color={Colors.text} />
                                    ) : (
                                        <>
                                            <CameraIcon size={24} color={Colors.text} />
                                            <Text style={styles.scanButtonText}>Skanuj kod QR</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {scanning && (
                        <View style={styles.cameraContainer}>
                            <Text style={styles.cameraTitle}>Wyceluj w kod QR</Text>
                            <View style={styles.cameraWrapper}>
                                <CameraView
                                    style={styles.camera}
                                    facing="back"
                                    onBarcodeScanned={handleQRScanned}
                                    barcodeScannerSettings={{
                                        barcodeTypes: ['qr'],
                                    }}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setScanning(false)}
                            >
                                <Text style={styles.cancelButtonText}>Anuluj</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {connected && !scanning && (
                        <View style={styles.controlsSection}>
                            {/* 2 Minutes Button */}
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

                            {/* 5 Minutes Button */}
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

                            {/* Disconnect Button */}
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
        marginBottom: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    statusSubtext: {
        fontSize: 14,
        color: Colors.textMuted,
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    pilotIDText: {
        fontSize: 12,
        color: Colors.textMuted,
        marginTop: 8,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    scanSection: {
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
    },
    scanButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    scanButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 20,
    },
    scanButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
    },
    cameraContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    cameraWrapper: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
    },
    camera: {
        flex: 1,
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 12,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    controlsSection: {
        flex: 1,
        justifyContent: 'center',
        gap: 16,
    },
    captureButton: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
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