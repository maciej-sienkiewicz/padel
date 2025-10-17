import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Camera, Smartphone } from 'lucide-react-native';
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';

export default function HomeScreen() {
    const router = useRouter();

    const handleCameraMode = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push('/camera');
    };

    const handleRemoteMode = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push('/remote');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.background, Colors.backgroundLight]}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                >
                    <View style={styles.content}>
                        {/* Logo/Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Padel Highlights</Text>
                            <Text style={styles.subtitle}>
                                Nagrywaj najlepsze akcje z meczu
                            </Text>
                        </View>

                        {/* Mode Selection */}
                        <View style={styles.modesContainer}>
                            {/* Camera Mode */}
                            <TouchableOpacity
                                style={styles.modeCard}
                                onPress={handleCameraMode}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.primaryDark]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.modeCardGradient}
                                >
                                    <View style={styles.modeIcon}>
                                        <Camera size={48} color={Colors.text} />
                                    </View>
                                    <Text style={styles.modeTitle}>Kamera</Text>
                                    <Text style={styles.modeDescription}>
                                        Nagrywa akcje po sygnale z pilotów
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Remote Mode */}
                            <TouchableOpacity
                                style={styles.modeCard}
                                onPress={handleRemoteMode}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#7C3AED', '#5B21B6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.modeCardGradient}
                                >
                                    <View style={styles.modeIcon}>
                                        <Smartphone size={48} color={Colors.text} />
                                    </View>
                                    <Text style={styles.modeTitle}>Pilot</Text>
                                    <Text style={styles.modeDescription}>
                                        Steruj nagrywaniem z drugiego telefonu
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Info Card */}
                            <View style={styles.infoCard}>
                                <Text style={styles.infoTitle}>💡 Tryb testowy</Text>
                                <Text style={styles.infoText}>
                                    Przed zbudowaniem pilotów ESP32, możesz przetestować aplikację używając dwóch telefonów:
                                </Text>
                                <Text style={styles.infoText}>
                                    • Telefon 1: Tryb "Kamera"
                                </Text>
                                <Text style={styles.infoText}>
                                    • Telefon 2: Tryb "Pilot"
                                </Text>
                                <Text style={styles.infoText}>
                                    • Wprowadź kod sesji na pilocie
                                </Text>
                                <Text style={styles.infoText}>
                                    • Naciskaj przyciski na pilocie!
                                </Text>
                            </View>
                        </View>
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
    scrollContent: {
        flexGrow: 1,
        paddingVertical: 24,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        minHeight: '100%',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textMuted,
        textAlign: 'center',
    },
    modesContainer: {
        gap: 20,
    },
    modeCard: {
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modeCardGradient: {
        padding: 32,
        alignItems: 'center',
    },
    modeIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 8,
    },
    modeDescription: {
        fontSize: 14,
        color: Colors.text,
        opacity: 0.9,
        textAlign: 'center',
    },
    infoCard: {
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: Colors.textMuted,
        marginBottom: 6,
        lineHeight: 20,
    },
});