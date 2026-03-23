import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { debug, ghApi, checkToken } from './shared.js';

const execFileAsync = promisify(execFile);

export default {
    definition: {
        name: 'github_gist_update',
        displayName: 'GitHub Gist Update',
        description: 'Update the content of a GitHub gist.',
        parameters: {
            type: 'object' as const,
            properties: {
                gist_id: {
                    type: 'string',
                    description: 'The gist ID (the hash from the gist URL).'
                },
                content: {
                    type: 'string',
                    description: 'The new file content for the gist.'
                }
            },
            required: ['gist_id', 'content']
        }
    },

    handler: async (args: { gist_id: string; content: string }) => {
        const { gist_id, content } = args;
        debug('github_gist_update called:', { gist_id, contentLength: content.length });

        const tokenErr = checkToken();
        if (tokenErr) return tokenErr;

        try {
            // Read gist to get the filename
            const existing = await ghApi(`/gists/${gist_id}`);
            const filename = Object.keys(existing.files || {})[0];
            if (!filename) {
                return { error: 'Gist has no files.' };
            }

            // Write JSON body to temp file for gh api --input
            const tmpFile = join(tmpdir(), `gist-update-${gist_id}-${Date.now()}.json`);
            await writeFile(tmpFile, JSON.stringify({
                files: { [filename]: { content } }
            }));

            let stdout: string;
            try {
                const result = await execFileAsync('gh', [
                    'api', `/gists/${gist_id}`,
                    '--method', 'PATCH',
                    '--input', tmpFile
                ], {
                    timeout: 30_000,
                    maxBuffer: 10 * 1024 * 1024
                });
                stdout = result.stdout;
            } finally {
                await unlink(tmpFile).catch(() => {});
            }

            const data = JSON.parse(stdout);
            return {
                action: 'gist_updated',
                gist_id,
                filename,
                updated_at: data.updated_at
            };
        } catch (err: any) {
            return { error: `Failed to update gist: ${err.message}` };
        }
    }
};
