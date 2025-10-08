import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Play, Trash2, Download } from 'lucide-react-native';
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    FlatList,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useRecording } from '@/contexts/RecordingContext';

export default function HighlightsScreen() {
    const router = useRouter();
    const { highlights, deleteHighlight } = useRecording();

    const handleBack = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    };

    const handlePlay = (id: string) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        console.log('Playing highlight:', id);
    };

    const handleDelete = (id: string) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        deleteHighlight(id);
    };

    const handleDownload = (id: string) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        console.log('Downloading highlight:', id);
    };

    const formatTime = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h temu`;
        }
        return `${minutes}min temu`;
    };

    const renderHighlight = ({ item }: { item: { id: string; timestamp: Date; duration: number; uri: string } }) => (
        <View style={styles.highlightCard}>
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                style={styles.highlightGradient}
            >
                <View style={styles.highlightThumbnail}>
                    <View style={styles.thumbnailPlaceholder}>
                        <Play size={32} color={Colors.text} fill={Colors.text} />
                    </View>
                </View>

                <View style={styles.highlightInfo}>
                    <Text style={styles.highlightTime}>{formatTime(item.timestamp)}</Text>
                    <Text style={styles.highlightDuration}>
                        {item.duration}s nagrania
                    </Text>
                </View>

                <View style={styles.highlightActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handlePlay(item.id)}
                    >
                        <Play size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDownload(item.id)}
                    >
                        <Download size={20} color={Colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDelete(item.id)}
                    >
                        <Trash2 size={20} color={Colors.accent} />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );

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
                    <Text style={styles.headerTitle}>Zapisane akcje</Text>
                    <View style={styles.placeholder} />
                </View>

                {highlights.length === 0 ? (
                    <ScrollView
                        contentContainerStyle={styles.emptyContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.emptyContent}>
                            <View style={styles.emptyIcon}>
                                <Play size={64} color={Colors.textMuted} />
                            </View>
                            <Text style={styles.emptyTitle}>Brak zapisanych akcji</Text>
                            <Text style={styles.emptyText}>
                                Naciśnij przycisk na pilocie, aby zapisać ciekawą akcję z meczu
                            </Text>
                        </View>
                    </ScrollView>
                ) : (
                    <FlatList
                        data={highlights}
                        renderItem={renderHighlight}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
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
        fontWeight: '700' as const,
        color: Colors.text,
    },
    placeholder: {
        width: 48,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    highlightCard: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    highlightGradient: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    highlightThumbnail: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 217, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    highlightInfo: {
        flex: 1,
        gap: 4,
    },
    highlightTime: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: Colors.text,
    },
    highlightDuration: {
        fontSize: 14,
        color: Colors.textMuted,
        fontWeight: '500' as const,
    },
    highlightActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyContent: {
        alignItems: 'center',
    },
    emptyIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: Colors.textMuted,
        textAlign: 'center',
        lineHeight: 24,
    },
});
