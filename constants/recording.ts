/**
 * Konfiguracja nagrywania - VISION CAMERA (continuous recording)
 *
 * NOWA ARCHITEKTURA:
 * - Jedno ciągłe nagrywanie (bez segmentów!)
 * - Timestamp-based capture marking
 * - Zero gaps!
 */

export const RecordingConfig = {
    // ===== VIDEO ENCODING SETTINGS =====
    VIDEO_SETTINGS: {
        codec: 'h264',
        width: 1920,
        height: 1080,
        bitrate: 6_000_000, // 6 Mbps
        profile: 'main',
        frameRate: 30,
    },

    // ===== CAPTURE DURATIONS =====
    CAPTURE_DURATIONS: [
        {
            label: '30 sekund',
            seconds: 30,
            color: ['#3B82F6', '#2563EB']
        },
        {
            label: '1 minuta',
            seconds: 60,
            color: ['#8B5CF6', '#7C3AED']
        },
        {
            label: '2 minuty',
            seconds: 120,
            color: ['#10B981', '#059669']
        },
    ],

    // ===== STORAGE SETTINGS =====
    HIGHLIGHTS_FOLDER: 'highlights/',
    GALLERY_ALBUM_NAME: 'Padel Highlights',

    // ===== DEPRECATED (kept for backwards compatibility) =====
    // Te wartości nie są już używane, ale zachowane dla kompatybilności
    SEGMENT_DURATION: 45,
    BUFFER_DURATION: 315,
    GOP_DURATION_SECONDS: 5,
    FRAME_RATE: 30,

    get GOP_SIZE() {
        return this.FRAME_RATE * this.GOP_DURATION_SECONDS;
    },

    get CUTTING_PRECISION_SECONDS() {
        return this.GOP_DURATION_SECONDS / 2;
    },

    get MAX_SEGMENTS_IN_BUFFER() {
        return Math.ceil(this.BUFFER_DURATION / this.SEGMENT_DURATION);
    },

    // ===== UTILITY FUNCTIONS =====
    estimateFileSize(durationSeconds: number): number {
        const bitratePerSecond = this.VIDEO_SETTINGS.bitrate / 8;
        const sizeBytes = bitratePerSecond * durationSeconds;
        return sizeBytes / 1024 / 1024; // MB
    },

    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check video settings
        if (this.VIDEO_SETTINGS.bitrate <= 0) {
            errors.push('Bitrate must be > 0');
        }

        if (this.VIDEO_SETTINGS.frameRate <= 0) {
            errors.push('Frame rate must be > 0');
        }

        // Check capture durations
        const maxCaptureDuration = Math.max(
            ...this.CAPTURE_DURATIONS.map(d => d.seconds)
        );

        if (maxCaptureDuration <= 0) {
            errors.push('At least one capture duration must be defined');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
} as const;

// Validate configuration on load
const validation = RecordingConfig.validate();
if (!validation.valid) {
    console.error('❌ Recording configuration errors:');
    validation.errors.forEach(error => console.error('  -', error));
    throw new Error('Invalid recording configuration');
}

console.log('✅ Recording configuration validated (vision-camera mode):');
console.log(`   Video: ${RecordingConfig.VIDEO_SETTINGS.width}x${RecordingConfig.VIDEO_SETTINGS.height}`);
console.log(`   Bitrate: ${RecordingConfig.VIDEO_SETTINGS.bitrate / 1_000_000}Mbps`);
console.log(`   Frame rate: ${RecordingConfig.VIDEO_SETTINGS.frameRate}fps`);
console.log(`   Capture options: ${RecordingConfig.CAPTURE_DURATIONS.map(d => d.label).join(', ')}`);
console.log(`   
📊 New architecture:
   ✅ Continuous recording (no segments)
   ✅ Zero gaps (Android) / ~30ms gaps (iOS)
   ✅ Exact duration capture
   ✅ Timestamp-based marking
`);

export default RecordingConfig;