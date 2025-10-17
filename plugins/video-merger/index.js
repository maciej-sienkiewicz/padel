const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for Video Merger Native Module
 * Dodaje natywne moduły iOS i Android do projektu
 */
function withVideoMerger(config) {
    // iOS Setup
    config = withDangerousMod(config, [
        'ios',
        async (config) => {
            const iosProjectRoot = config.modRequest.platformProjectRoot;
            const videoMergerPath = path.join(iosProjectRoot, 'VideoMerger');

            // Stwórz folder VideoMerger
            if (!fs.existsSync(videoMergerPath)) {
                fs.mkdirSync(videoMergerPath, { recursive: true });
            }

            // Kopiuj pliki iOS
            const pluginDir = path.join(__dirname, 'ios');

            if (fs.existsSync(pluginDir)) {
                const files = fs.readdirSync(pluginDir);
                files.forEach(file => {
                    const sourcePath = path.join(pluginDir, file);
                    const destPath = path.join(videoMergerPath, file);
                    fs.copyFileSync(sourcePath, destPath);
                });
            }

            console.log('✅ Video Merger iOS module added');
            return config;
        },
    ]);

    // Android Setup
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const androidProjectRoot = config.modRequest.platformProjectRoot;
            const packagePath = path.join(
                androidProjectRoot,
                'app/src/main/java/com/padel/videomerger'
            );

            // Stwórz folder
            if (!fs.existsSync(packagePath)) {
                fs.mkdirSync(packagePath, { recursive: true });
            }

            // Kopiuj pliki Android
            const pluginDir = path.join(__dirname, 'android');

            if (fs.existsSync(pluginDir)) {
                const files = fs.readdirSync(pluginDir);
                files.forEach(file => {
                    const sourcePath = path.join(pluginDir, file);
                    const destPath = path.join(packagePath, file);
                    fs.copyFileSync(sourcePath, destPath);
                });
            }

            // Dodaj package do MainApplication
            const mainAppPath = path.join(
                androidProjectRoot,
                'app/src/main/java/com/padel/MainApplication.kt'
            );

            if (fs.existsSync(mainAppPath)) {
                let mainAppContent = fs.readFileSync(mainAppPath, 'utf8');

                // Dodaj import
                if (!mainAppContent.includes('import com.padel.videomerger.VideoMergerPackage')) {
                    mainAppContent = mainAppContent.replace(
                        'import android.app.Application',
                        'import android.app.Application\nimport com.padel.videomerger.VideoMergerPackage'
                    );
                }

                // Dodaj package do listy
                if (!mainAppContent.includes('VideoMergerPackage()')) {
                    mainAppContent = mainAppContent.replace(
                        'override val reactNativeHost: ReactNativeHost =',
                        `override val reactNativeHost: ReactNativeHost =`
                    );
                }

                fs.writeFileSync(mainAppPath, mainAppContent);
            }

            console.log('✅ Video Merger Android module added');
            return config;
        },
    ]);

    return config;
}

module.exports = withVideoMerger;