import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from '../config-manager.js';
import { logger } from '../logger.js';

export async function checkForUpdates() {
    logger.log({
        type: 'system',
        level: 'info',
        message: '[Update] Starting manual update check...'
    });

    try {
        const currentConfig = loadConfig();
        const localReleasePath = path.resolve(process.cwd(), 'LATEST_RELEASE.txt');

        // 1. Sync local version from LATEST_RELEASE.txt
        let localVersion = currentConfig.system?.version || "Unknown";
        if (fs.existsSync(localReleasePath)) {
            localVersion = fs.readFileSync(localReleasePath, 'utf-8').trim();
            if (!currentConfig.system) {
                currentConfig.system = { version: localVersion, latestVersion: "", updateCheckInterval: 3600000 };
            }

            if (currentConfig.system.version !== localVersion) {
                console.log(`[System] Updating local version in config: ${currentConfig.system.version} -> ${localVersion}`);
                currentConfig.system.version = localVersion;
                saveConfig(currentConfig);
            }
        }

        logger.log({
            type: 'system',
            level: 'info',
            message: `[Update] Local version is: ${localVersion}`
        });

        // 2. Fetch remote version from GitHub
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

            // Re-load config in case it was updated above
            const updatedConfig = loadConfig();
            if (!updatedConfig.system) {
                updatedConfig.system = { version: "2026-02-18", latestVersion: "" };
            }

            if (updatedConfig.system.latestVersion !== latestVersion) {
                updatedConfig.system.latestVersion = latestVersion;
                saveConfig(updatedConfig);
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
