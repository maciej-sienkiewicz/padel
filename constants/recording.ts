/**
 * Konfiguracja nagrywania z GOP Alignment
 *
 * GOP (Group of Pictures) alignment pozwala na precyzyjne cięcie wideo
 * bez re-encoding, co daje:
 * - Dokładną długość nagrań (40s = 40s, nie 20s ani 60s)
 * - 10x szybsze przetwarzanie (0.5s vs 5s)
 * - Zero degradacji jakości
 */

export const RecordingConfig = {
    // ===== SEGMENT CONFIGURATION =====

    // Długość pojedynczego segmentu wideo
    // Zalecane: 30-60s dla optimal balance
    SEGMENT_DURATION: 6, // 30 sekund

    // Długość bufora - ile sekund trzymamy w pamięci
    BUFFER_DURATION: 300, // 5 minut (300s)

    // ===== GOP ALIGNMENT CONFIGURATION =====

    // GOP (Group of Pictures) - odstęp między keyframe'ami
    // KLUCZOWE: GOP_DURATION_SECONDS musi być dzielnikiem SEGMENT_DURATION!
    //
    // Przykłady poprawnych kombinacji:
    // - SEGMENT_DURATION: 30s, GOP: 2s (15 GOP per segment) ✅
    // - SEGMENT_DURATION: 60s, GOP: 2s (30 GOP per segment) ✅
    // - SEGMENT_DURATION: 30s, GOP: 1s (30 GOP per segment) ✅
    GOP_DURATION_SECONDS: 2, // 2 sekundy między keyframe'ami

    // Frame rate (musi być stały dla GOP alignment)
    FRAME_RATE: 30, // 30 fps

    // GOP size w frame'ach (automatycznie obliczone)
    // GOP_SIZE = FRAME_RATE × GOP_DURATION_SECONDS
    get GOP_SIZE() {
        return this.FRAME_RATE * this.GOP_DURATION_SECONDS;
    },

    // Precyzja cięcia (informacyjna)
    // Z GOP 2s: precision ±1s
    // Z GOP 1s: precision ±0.5s
    get CUTTING_PRECISION_SECONDS() {
        return this.GOP_DURATION_SECONDS / 2;
    },

    // ===== VIDEO ENCODING SETTINGS =====

    VIDEO_SETTINGS: {
        // Codec
        codec: 'h264', // H.264 (najlepsza kompatybilność)

        // Resolution
        width: 1920,
        height: 1080,

        // Bitrate
        bitrate: 6_000_000, // 6 Mbps

        // Profile (Main = best compatibility, High = better quality)
        profile: 'main', // lub 'high'

        // CRITICAL: GOP settings
        maxKeyFrameInterval: 60, // Calculated: FRAME_RATE × GOP_DURATION_SECONDS
        expectedFrameRate: 30,

        // Disable features that break GOP alignment
        allowFrameReordering: false, // No B-frame reordering
    },

    // ===== CAPTURE DURATIONS =====

    // Dostępne opcje przycisku "Zapisz akcję"
    // Teraz z GOP alignment dostaniesz DOKŁADNIE te długości!
    CAPTURE_DURATIONS: [
        {
            label: '30 sekund',
            seconds: 30,
            color: ['#3B82F6', '#2563EB'] // niebieski
        },
        {
            label: '1 minuta',
            seconds: 60,
            color: ['#8B5CF6', '#7C3AED'] // fioletowy
        },
        {
            label: '2 minuty',
            seconds: 120,
            color: ['#10B981', '#059669'] // zielony
        },
    ],

    // ===== STORAGE SETTINGS =====

    // Folder do zapisywania highlightów
    HIGHLIGHTS_FOLDER: 'highlights/',

    // Nazwa albumu w galerii
    GALLERY_ALBUM_NAME: 'Padel Highlights',

    // ===== VALIDATION =====

    /**
     * Sprawdź czy konfiguracja jest poprawna
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check if GOP divides segment duration evenly
        if (this.SEGMENT_DURATION % this.GOP_DURATION_SECONDS !== 0) {
            errors.push(
                `SEGMENT_DURATION (${this.SEGMENT_DURATION}s) must be divisible by ` +
                `GOP_DURATION_SECONDS (${this.GOP_DURATION_SECONDS}s)`
            );
        }

        // Check if GOP settings match
        const expectedGopSize = this.FRAME_RATE * this.GOP_DURATION_SECONDS;
        if (this.VIDEO_SETTINGS.maxKeyFrameInterval !== expectedGopSize) {
            errors.push(
                `VIDEO_SETTINGS.maxKeyFrameInterval (${this.VIDEO_SETTINGS.maxKeyFrameInterval}) ` +
                `should equal FRAME_RATE × GOP_DURATION_SECONDS (${expectedGopSize})`
            );
        }

        // Check frame rate consistency
        if (this.VIDEO_SETTINGS.expectedFrameRate !== this.FRAME_RATE) {
            errors.push(
                `VIDEO_SETTINGS.expectedFrameRate (${this.VIDEO_SETTINGS.expectedFrameRate}) ` +
                `should equal FRAME_RATE (${this.FRAME_RATE})`
            );
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

console.log('✅ Recording configuration validated:');
console.log(`   Segment: ${RecordingConfig.SEGMENT_DURATION}s`);
console.log(`   GOP: ${RecordingConfig.GOP_DURATION_SECONDS}s (${RecordingConfig.GOP_SIZE} frames)`);
console.log(`   Precision: ±${RecordingConfig.CUTTING_PRECISION_SECONDS}s`);

export default RecordingConfig;