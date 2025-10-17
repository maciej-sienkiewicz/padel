import { NativeModules, Platform } from 'react-native';

interface VideoMergerInterface {
    /**
     * Łączy wiele plików wideo w jeden (podstawowa funkcja)
     * @param videoPaths - tablica ścieżek do plików MP4
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     * @returns Promise z ścieżką do połączonego pliku
     */
    mergeVideos(videoPaths: string[], outputPath: string): Promise<string>;

    /**
     * 🆕 Wyciąga precyzyjny fragment wideo z GOP-aligned segments
     *
     * Ta funkcja pozwala wyciąć DOKŁADNIE określony czas z nagrań segmentowych.
     * Działa bez re-encoding (ultra szybko) dzięki GOP alignment.
     *
     * @param videoPaths - tablica ścieżek do segmentów MP4 (w kolejności chronologicznej)
     * @param startTimeSeconds - offset w PIERWSZYM segmencie (w sekundach od początku pierwszego pliku)
     * @param durationSeconds - ile sekund wideo wyciąć
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     *
     * @returns Promise z ścieżką do wyciętego fragmentu
     *
     * @example
     * // Masz 3 segmenty po 20s każdy: [0-20s, 20-40s, 40-60s]
     * // Chcesz wyciąć 40s zaczynając od 25s globalnego czasu
     * // 25s to 5s offsetu w drugim segmencie (który zaczyna się w 20s)
     *
     * const segments = [
     *   'file:///segment1.mp4', // 0-20s
     *   'file:///segment2.mp4', // 20-40s
     *   'file:///segment3.mp4', // 40-60s
     * ];
     *
     * // Oblicz offset: chcesz zacząć od 25s globalnie
     * // Pierwszy relevant segment to segment2 (zaczyna się w 20s)
     * // Więc offset = 25s - 20s = 5s
     *
     * const result = await VideoMerger.extractPreciseClip(
     *   segments.slice(1), // Zaczynamy od segment2
     *   5.0,               // 5s offset w segment2
     *   40.0,              // 40s długości
     *   'file:///output.mp4'
     * );
     *
     * // Rezultat: dokładnie 40s wideo zaczynające się od 25s globalnego czasu
     */
    extractPreciseClip(
        videoPaths: string[],
        startTimeSeconds: number,
        durationSeconds: number,
        outputPath: string
    ): Promise<string>;
}

const LINKING_ERROR =
    `The package 'VideoMerger' doesn't seem to be linked. Make sure: \n\n` +
    Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo Go\n';

const VideoMerger: VideoMergerInterface = NativeModules.VideoMerger
    ? NativeModules.VideoMerger
    : new Proxy(
        {},
        {
            get() {
                throw new Error(LINKING_ERROR);
            },
        }
    );

export default VideoMerger;