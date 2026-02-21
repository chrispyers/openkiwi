import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');

export default {
    definition: {
        name: 'describe_image',
        description: 'See and describe the contents of an image file in your workspace or screenshots folder.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'The name of the image file (e.g., "screenshot.png").'
                },
                prompt: {
                    type: 'string',
                    description: 'What you want to know about the image (optional).'
                }
            },
            required: ['filename']
        }
    },
    handler: async ({ filename, prompt }: { filename: string; prompt?: string }) => {
        try {
            const name = path.basename(filename);
            let fullPath = path.join(WORKSPACE_DIR, name);

            if (!fs.existsSync(fullPath)) {
                fullPath = path.join(SCREENSHOTS_DIR, name);
            }

            if (!fs.existsSync(fullPath)) {
                return { error: `Image file "${filename}" not found in workspace or screenshots.` };
            }

            // By returning this, the system's vision processor will automatically 
            // attach the image to the conversation context.
            return {
                message: prompt ? `Looking at ${filename} to address: "${prompt}"` : `Inspecting image: ${filename}`,
                image_url: `/workspace-files/${name}`
            };
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
