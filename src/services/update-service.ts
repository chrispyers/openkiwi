import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig } from '../config-manager.js';

export async function checkForUpdates() {
    try {
        const currentConfig = loadConfig();
        const localReleasePath = path.resolve(process.cwd(), 'LATEST_RELEASE.txt');

        // 1. Sync local version from LATEST_RELEASE.txt
        if (fs.existsSync(localReleasePath)) {
            const localVersion = fs.readFileSync(localReleasePath, 'utf-8').trim();
            if (!currentConfig.system) {
                currentConfig.system = { version: localVersion, latestVersion: "" };
            }

            if (currentConfig.system.version !== localVersion) {
                console.log(`[System] Updating local version in config: ${currentConfig.system.version} -> ${localVersion}`);
                currentConfig.system.version = localVersion;
                saveConfig(currentConfig);
            }
        }

        // 2. Fetch remote version from GitHub
        const url = 'https://raw.githubusercontent.com/chrispyers/openkiwi/refs/heads/main/LATEST_RELEASE.txt';
        const response = await fetch(url);
        if (response.ok) {
            const latestVersion = (await response.text()).trim();

            // Re-load config in case it was updated above
            const updatedConfig = loadConfig();
            if (!updatedConfig.system) {
                updatedConfig.system = { version: "2026-02-18", latestVersion: "" };
            }

            if (updatedConfig.system.latestVersion !== latestVersion) {
                updatedConfig.system.latestVersion = latestVersion;
                saveConfig(updatedConfig);
                console.log(`[Update] New remote version detected: ${latestVersion}`);
            }
        }
    } catch (error) {
        console.error('[Update] Failed to sync versions:', error);
    }
}
