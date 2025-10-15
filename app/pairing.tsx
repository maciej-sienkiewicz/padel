import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Server, Wifi } from 'lucide-react-native';
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

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function PairingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const role = params.role as 'camera' | 'remote';

    const { startAsCamera, connectToCamera, isConnected } = useRecording();

    const [isLoading, setIsLoading] = useState(false);

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    };

    const handleStartCamera = async () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setIsLoading(true);

        try {
            // Uruchom tryb kamery
            await startAsCamera();

            // Poczekaj chwilę i przejdź do ekranu kamery
            setTimeout(() => {
                router.replace('/camera');
            }, 500);
        } catch (error) {
            console.error('Failed to start camera:', error);
            Alert.alert('Błąd', 'Nie udało się uruchomić trybu kamery');
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
                    <Text style={styles.headerTitle}>Tryb Kamera</Text>
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
                        <Text style={styles.title}>Tryb Kamera</Text>
                        <Text style={styles.subtitle}>
                            Uruchom hotspot WiFi na tym telefonie, aby pilot mógł się połączyć
                        </Text>
                    </View>

                    <View style={styles.serverSetupContainer}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoTitle}>📱 Jak skonfigurować?</Text>
                            <Text style={styles.infoText}>1. Naciśnij "Uruchom kamerę" poniżej</Text>
                            <Text style={styles.infoText}>2. Włącz hotspot WiFi w ustawieniach telefonu</Text>
                            <Text style={styles.infoText}>3. Zapamiętaj nazwę sieci i hasło</Text>
                            <Text style={styles.infoText}>4. Wróć do aplikacji i pokaż QR kod</Text>
                            <Text style={styles.infoText}>5. Pilot: połącz się z hotspotem i skanuj QR</Text>
                        </View>

                        <View style={styles.inputSection}>
                            <TouchableOpacity
                                style={[
                                    styles.connectButton,
                                    isLoading && styles.connectButtonDisabled
                                ]}
                                onPress={handleStartCamera}
                                disabled={isLoading}
                            >
                                <LinearGradient
                                    colors={
                                        isLoading
                                            ? [Colors.textMuted, Colors.backgroundLight]
                                            : [Colors.primary, Colors.primaryDark]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.connectButtonGradient}
                                >
                                    <Text style={styles.connectButtonText}>
                                        {isLoading ? 'Uruchamianie...' : 'Uruchom kamerę'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tipsContainer}>
                        <Text style={styles.tipsTitle}>💡 Wskazówki:</Text>
                        <Text style={styles.tipText}>
                            • Kamera nie wymaga internetu - tylko hotspot
                        </Text>
                        <Text style={styles.tipText}>
                            • Hotspot: Ustawienia → Sieć → Hotspot WiFi
                        </Text>
                        <Text style={styles.tipText}>
                            • Pilot musi się połączyć z hotspotem kamery
                        </Text>
                        <Text style={styles.tipText}>
                            • Wszystko działa lokalnie - idealne na kort!
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