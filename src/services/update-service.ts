import { loadConfig, saveConfig } from '../config-manager.js';
import { logger } from '../logger.js';

export function getAppVersion(): string {
    return process.env.APP_VERSION || 'dev';
}

export async function checkForUpdates() {
    logger.log({
        type: 'system',
        level: 'info',
        message: '[Update] Starting manual update check...'
    });

    try {
        const localVersion = getAppVersion();

        logger.log({
            type: 'system',
            level: 'info',
            message: `[Update] Local version is: ${localVersion}`
        });

        // Fetch remote version from GitHub
        const url = 'https://raw.githubusercontent.com/chrispyers/openkiwi/refs/heads/main/LATEST_RELEASE.txt';
        logger.log({
            type: 'system',
            level: 'info',
            message: `[Update] Fetching remote version from GitHub...`
        });

        const response = await fetch(url);
        if (response.ok) {
            const latestVersion = (await response.text()).trim();
            logger.log({
                type: 'system',
                level: 'info',
                message: `[Update] Remote version is: ${latestVersion}`
            });

            // Persist latestVersion so the UI can display it
            const currentConfig = loadConfig();
            if (currentConfig.system.latestVersion !== latestVersion) {
                currentConfig.system.latestVersion = latestVersion;
                saveConfig(currentConfig);
            }

            if (localVersion === latestVersion) {
                logger.log({
                    type: 'system',
                    level: 'info',
                    message: `[Update] System is up to date.`
                });
            } else {
                logger.log({
                    type: 'system',
                    level: 'info',
                    message: `[Update] New version available: ${latestVersion}`
                });
            }
        } else {
            logger.log({
                type: 'system',
                level: 'error',
                message: `[Update] Failed to fetch remote version: ${response.status} ${response.statusText}`
            });
        }
    } catch (error) {
        logger.log({
            type: 'system',
            level: 'error',
            message: `[Update] Error during update check: ${String(error)}`
        });
        console.error('[Update] Failed to sync versions:', error);
    }
}
