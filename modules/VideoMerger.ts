import { NativeModules, Platform } from 'react-native';

interface VideoMergerInterface {
    /**
     * Łączy wiele plików wideo w jeden
     * @param videoPaths - tablica ścieżek do plików MP4
     * @param outputPath - ścieżka gdzie zapisać wynikowy plik
     * @returns Promise z ścieżką do połączonego pliku
     */
    mergeVideos(videoPaths: string[], outputPath: string): Promise<string>;
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