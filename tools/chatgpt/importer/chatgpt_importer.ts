import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

export default {
    definition: {
        name: 'chatgpt_importer',
        displayName: 'ChatGPT Importer',
        pluginType: 'tool',
        description: 'Imports ChatGPT history using an authentication token and saves it to a workspace folder. Requires the ChatGPT Authenticator plugin.',
        parameters: {
            type: 'object',
            properties: {
                authToken: {
                    type: 'string',
                    description: 'Authentication token (JWT) obtained by running the chatgpt_auth tool first.'
                },
                outputDir: {
                    type: 'string',
                    description: 'Relative path within the workspace where chat sessions will be saved.'
                }
            },
            required: ['authToken', 'outputDir']
        }
    },
    handler: async ({ authToken, outputDir }: { authToken: string; outputDir: string }) => {
        try {
            if (!authToken) throw new Error('Auth token is required. Please run the chatgpt_auth tool first.');
            if (!outputDir) throw new Error('Output directory is required');

            // 1. Path Safety Check
            const targetPath = path.join(WORKSPACE_DIR, outputDir);
            if (targetPath !== WORKSPACE_DIR && !targetPath.startsWith(WORKSPACE_DIR + path.sep)) {
                throw new Error('Access denied: Selected output directory is outside of the workspace');
            }

            // 2. Ensure Output Directory Exists
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }

            // 3. Fetch and Process Conversations in Batches
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            let savedCount = 0;

            console.log(`[chatgpt_importer] Fetching and processing conversation lists in batches...`);

            while (hasMore) {
                console.log(`[chatgpt_importer] Fetching conversation headers at offset ${offset}...`);
                const listResponse = await fetch(`https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!listResponse.ok) {
                    const errorText = await listResponse.text();
                    throw new Error(`Failed to fetch chat history list at offset ${offset}: ${listResponse.status} ${listResponse.statusText}. Details: ${errorText}`);
                }

                const listData = await listResponse.json();
                const items = listData.items || [];

                console.log(`[chatgpt_importer] Processing ${items.length} conversations from this batch...`);

                // 4. Write Sessions to Disk
                for (const item of items) {
                    const conversationId = item.id;

                    // Fetch full conversation details for each session
                    const detailResponse = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (detailResponse.ok) {
                        const detailData = await detailResponse.json();

                        const safeFilename = `${conversationId}.json`;
                        const sessionPath = path.join(targetPath, safeFilename);

                        fs.writeFileSync(sessionPath, JSON.stringify(detailData, null, 2), 'utf-8');
                        savedCount++;
                    } else {
                        console.warn(`[chatgpt_importer] Failed to fetch details for conversation ${conversationId}`);
                    }
                }

                // If we got fewer items than the limit, we've reached the end
                if (items.length < limit || (listData.total !== undefined && offset + items.length >= listData.total)) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }

            return {
                success: true,
                message: `Successfully imported ${savedCount} chat sessions into '${outputDir}'.`
            };

        } catch (error: any) {
            return { error: error.message };
        }
    }
};
