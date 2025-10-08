import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Video, Camera } from 'lucide-react-native';
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';

export default function HomeScreen() {
    const router = useRouter();
    const scaleAnim1 = React.useRef(new Animated.Value(1)).current;
    const scaleAnim2 = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = (anim: Animated.Value) => {
        Animated.spring(anim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = (anim: Animated.Value) => {
        Animated.spring(anim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const handleCameraPress = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        router.push('/camera');
    };

    const handleRemotePress = () => {
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
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Padel Highlights</Text>
                        <Text style={styles.subtitle}>
                            Wybierz tryb urządzenia
                        </Text>
                    </View>

                    <View style={styles.buttonsContainer}>
                        <Animated.View
                            style={[
                                styles.buttonWrapper,
                                { transform: [{ scale: scaleAnim1 }] },
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPressIn={() => handlePressIn(scaleAnim1)}
                                onPressOut={() => handlePressOut(scaleAnim1)}
                                onPress={handleCameraPress}
                                style={styles.button}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.primaryDark]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.buttonGradient}
                                >
                                    <View style={styles.iconContainer}>
                                        <Camera size={48} color={Colors.text} strokeWidth={2} />
                                    </View>
                                    <Text style={styles.buttonTitle}>Kamera</Text>
                                    <Text style={styles.buttonDescription}>
                                        Nagrywa akcje przy ścianie
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.buttonWrapper,
                                { transform: [{ scale: scaleAnim2 }] },
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPressIn={() => handlePressIn(scaleAnim2)}
                                onPressOut={() => handlePressOut(scaleAnim2)}
                                onPress={handleRemotePress}
                                style={styles.button}
                            >
                                <LinearGradient
                                    colors={[Colors.accent, '#FF1744']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.buttonGradient}
                                >
                                    <View style={styles.iconContainer}>
                                        <Video size={48} color={Colors.text} strokeWidth={2} />
                                    </View>
                                    <Text style={styles.buttonTitle}>Pilot</Text>
                                    <Text style={styles.buttonDescription}>
                                        Steruje nagrywaniem akcji
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
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
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 60,
        alignItems: 'center',
    },
    title: {
        fontSize: 42,
        fontWeight: '800' as const,
        color: Colors.text,
        marginBottom: 12,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 18,
        color: Colors.textMuted,
        fontWeight: '500' as const,
    },
    buttonsContainer: {
        gap: 20,
    },
    buttonWrapper: {
        width: '100%',
    },
    button: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    buttonGradient: {
        paddingVertical: 40,
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    buttonTitle: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: Colors.text,
        marginBottom: 8,
    },
    buttonDescription: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500' as const,
    },
});
