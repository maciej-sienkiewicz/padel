import { NativeModules, Platform } from 'react-native';

interface VideoMergerInterface {
    /**
     * Łączy wiele plików wideo w jeden (podstawowa funkcja - całe segmenty)
     * @param videoPaths - tablica ścieżek do plików MP4
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     * @returns Promise z ścieżką do połączonego pliku
     */
    mergeVideos(videoPaths: string[], outputPath: string): Promise<string>;

    /**
     * ⚡ Wyciąga precyzyjny fragment wideo z GOP-aligned segments (passthrough - szybkie)
     *
     * Używa passthrough (bez re-encoding) - SZYBKIE ale może mieć szarpania
     * jeśli segmenty nie są GOP-aligned.
     *
     * @param videoPaths - tablica ścieżek do segmentów MP4 (w kolejności chronologicznej)
     * @param startTimeSeconds - offset w PIERWSZYM segmencie (w sekundach)
     * @param durationSeconds - ile sekund wideo wyciąć
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     * @returns Promise z ścieżką do wyciętego fragmentu
     */
    extractPreciseClip(
        videoPaths: string[],
        startTimeSeconds: number,
        durationSeconds: number,
        outputPath: string
    ): Promise<string>;

    /**
     * 🎯 Łączy precyzyjny fragment z wielu segmentów (re-encoding - idealne połączenie)
     *
     * ✅ ROZWIĄZUJE DWA PROBLEMY:
     * 1. Dokładna długość nagrania (40s = 40s, nie 20s ani 60s)
     * 2. Zero szarpań (re-encoding z fixed GOP i timestamp normalization)
     *
     * Ta funkcja używa RE-ENCODING, więc jest wolniejsza (~10-30% czasu wideo)
     * ale daje IDEALNY rezultat bez żadnych przeskoków.
     *
     * @param videoPaths - tablica ścieżek do segmentów MP4 (w kolejności chronologicznej)
     * @param globalStartTime - globalny timestamp początku w MILISEKUNDACH (kiedy zaczynamy wycinać)
     * @param durationSeconds - ile sekund wideo chcemy
     * @param segmentStartTimes - globalne timestampy początku każdego segmentu w MILISEKUNDACH
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     * @returns Promise z ścieżką do połączonego fragmentu
     *
     * @example
     * // Masz 3 segmenty:
     * // - Segment 1: nagrany od 10:00:00.000 (timestamp: 1704006000000), duration: 30s
     * // - Segment 2: nagrany od 10:00:30.000 (timestamp: 1704006030000), duration: 30s
     * // - Segment 3: nagrany od 10:01:00.000 (timestamp: 1704006060000), duration: 30s
     *
     * // Chcesz wyciąć ostatnie 40s (czyli od 10:00:50 do 10:01:30)
     * const now = Date.now(); // 1704006090000 (10:01:30)
     * const requestedDuration = 40; // sekund
     * const globalStartTime = now - (requestedDuration * 1000); // 1704006050000 (10:00:50)
     *
     * const result = await VideoMerger.mergePreciseClip(
     *   [
     *     'file:///segment2.mp4', // od 10:00:30
     *     'file:///segment3.mp4', // od 10:01:00
     *   ],
     *   globalStartTime,              // 1704006050000 (10:00:50)
     *   requestedDuration,            // 40 sekund
     *   [
     *     1704006030000,              // segment2 zaczyna się o 10:00:30
     *     1704006060000,              // segment3 zaczyna się o 10:01:00
     *   ],
     *   'file:///output.mp4'
     * );
     *
     * // Rezultat: dokładnie 40s wideo bez szarpań!
     * // - Z segment2: wyciąga 20s (od 20s do końca segmentu)
     * // - Z segment3: wyciąga 20s (od początku do 20s segmentu)
     */
    mergePreciseClip(
        videoPaths: string[],
        globalStartTime: number,
        durationSeconds: number,
        segmentStartTimes: number[],
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