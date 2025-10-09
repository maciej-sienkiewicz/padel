import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, QrCode, ScanLine, Wifi, Server } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    TextInput,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function PairingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const role = params.role as 'camera' | 'remote';

    const { startAsCamera, connectToCamera, serverAddress, isConnected } = useRecording();

    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false);
    const [manualAddress, setManualAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showServerInput, setShowServerInput] = useState(true);

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    };

    const handleConnectToServer = async () => {
        if (!manualAddress.trim()) {
            Alert.alert('Błąd', 'Wprowadź adres serwera');
            return;
        }

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setIsLoading(true);

        try {
            if (role === 'camera') {
                // Kamera też łączy się z serwerem
                await startAsCamera();
                await connectToCamera(manualAddress.trim());

                // Poczekaj chwilę i przejdź do ekranu kamery
                setTimeout(() => {
                    router.push('/camera');
                }, 1000);
            } else {
                // Pilot łączy się z serwerem
                await connectToCamera(manualAddress.trim());

                // Poczekaj chwilę i przejdź do ekranu pilota
                setTimeout(() => {
                    router.push('/remote');
                }, 1000);
            }
        } catch (error) {
            console.error('Connection failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.background, Colors.backgroundLight]}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <View style={styles.iconButton}>
                            <ArrowLeft size={24} color={Colors.text} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {role === 'camera' ? 'Tryb Kamera' : 'Tryb Pilot'}
                    </Text>
                    <View style={styles.placeholder} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.instructionContainer}>
                        <View style={styles.iconCircle}>
                            <Server size={48} color={Colors.primary} />
                        </View>
                        <Text style={styles.title}>Połącz z serwerem</Text>
                        <Text style={styles.subtitle}>
                            {role === 'camera'
                                ? 'Wpisz adres serwera, aby zarejestrować kamerę'
                                : 'Wpisz adres serwera, aby sterować kamerą'
                            }
                        </Text>
                    </View>

                    <View style={styles.serverSetupContainer}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoTitle}>ℹ️ Jak uruchomić serwer?</Text>
                            <Text style={styles.infoText}>1. Na komputerze otwórz terminal</Text>
                            <Text style={styles.infoText}>2. Przejdź do folderu: cd padel-server</Text>
                            <Text style={styles.infoText}>3. Uruchom: node server.js</Text>
                            <Text style={styles.infoText}>4. Skopiuj adres IP (np. 192.168.1.5:8080)</Text>
                            <Text style={styles.infoText}>5. Wklej poniżej</Text>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Adres serwera:</Text>
                            <View style={styles.inputContainer}>
                                <Wifi size={20} color={Colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="192.168.1.5:8080"
                                    placeholderTextColor={Colors.textMuted}
                                    value={manualAddress}
                                    onChangeText={setManualAddress}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                    editable={!isLoading}
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.connectButton,
                                    (!manualAddress.trim() || isLoading) && styles.connectButtonDisabled
                                ]}
                                onPress={handleConnectToServer}
                                disabled={!manualAddress.trim() || isLoading}
                            >
                                <LinearGradient
                                    colors={
                                        !manualAddress.trim() || isLoading
                                            ? [Colors.textMuted, Colors.backgroundLight]
                                            : [Colors.primary, Colors.primaryDark]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.connectButtonGradient}
                                >
                                    <Text style={styles.connectButtonText}>
                                        {isLoading ? 'Łączenie...' : 'Połącz z serwerem'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.examplesContainer}>
                        <Text style={styles.examplesTitle}>Przykłady adresów:</Text>
                        <TouchableOpacity
                            style={styles.exampleButton}
                            onPress={() => setManualAddress('192.168.1.5:8080')}
                        >
                            <Text style={styles.exampleText}>192.168.1.5:8080</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exampleButton}
                            onPress={() => setManualAddress('192.168.0.10:8080')}
                        >
                            <Text style={styles.exampleText}>192.168.0.10:8080</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.exampleButton}
                            onPress={() => setManualAddress('10.0.0.5:8080')}
                        >
                            <Text style={styles.exampleText}>10.0.0.5:8080</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tipsContainer}>
                        <Text style={styles.tipsTitle}>💡 Wskazówki:</Text>
                        <Text style={styles.tipText}>
                            • Upewnij się, że serwer jest uruchomiony na komputerze
                        </Text>
                        <Text style={styles.tipText}>
                            • Telefony i komputer muszą być w tej samej sieci WiFi
                        </Text>
                        <Text style={styles.tipText}>
                            • Nie wyłączaj komputera podczas meczu
                        </Text>
                        <Text style={styles.tipText}>
                            • Port zawsze wynosi :8080
                        </Text>
                    </View>
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
    content: {
        padding: 24,
    },
    instructionContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    serverSetupContainer: {
        marginBottom: 24,
    },
    infoBox: {
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.2)',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: Colors.text,
        marginBottom: 6,
        lineHeight: 20,
    },
    inputSection: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputLabel: {
        fontSize: 14,
        color: Colors.textMuted,
        marginBottom: 12,
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 12,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        paddingVertical: 16,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    connectButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    connectButtonDisabled: {
        opacity: 0.6,
    },
    connectButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    connectButtonText: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    examplesContainer: {
        marginBottom: 24,
    },
    examplesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textMuted,
        marginBottom: 12,
    },
    exampleButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    exampleText: {
        color: Colors.primary,
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    tipsContainer: {
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.2)',
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 12,
    },
    tipText: {
        fontSize: 14,
        color: Colors.text,
        marginBottom: 8,
        lineHeight: 20,
    },
});