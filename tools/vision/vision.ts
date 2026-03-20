import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');

export default {
    definition: {
        name: 'describe_image',
        displayName: 'Image Analysis',
        pluginType: 'skill',
        description: 'See and describe the contents of an image file in your workspace or screenshots folder.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The fully qualified absolute path to the image file (e.g., "/app/workspace/screenshot.png").'
                },
                prompt: {
                    type: 'string',
                    description: 'What you want to know about the image (optional).'
                }
            },
            required: ['path']
        }
    },
    handler: async ({ path: filePath, prompt }: { path: string; prompt?: string }) => {
        try {
            // Allow subdirectories but prevent directory traversal
            let fullPath = path.resolve(WORKSPACE_DIR, filePath);
            if (!fullPath.startsWith(WORKSPACE_DIR)) {
                fullPath = path.resolve(SCREENSHOTS_DIR, filePath);
                if (!fullPath.startsWith(SCREENSHOTS_DIR)) {
                    return { error: `Access denied: ${filePath}` };
                }
            }

            if (!fs.existsSync(fullPath)) {
                return { error: `Image file "${filePath}" not found in workspace or screenshots.` };
            }

            // Return a URL that the vision processor in index.ts will recognize
            const isScreenshot = fullPath.startsWith(SCREENSHOTS_DIR);
            const relativePath = isScreenshot
                ? path.relative(SCREENSHOTS_DIR, fullPath)
                : path.relative(WORKSPACE_DIR, fullPath);

            const url = isScreenshot ? `/screenshots/${relativePath}` : `/workspace-files/${relativePath}`;

            // By returning this, the system's vision processor will automatically 
            // attach the image to the conversation context.
            return {
                message: prompt ? `Looking at ${filePath} to address: "${prompt}"` : `Inspecting image: ${filePath}`,
                image_url: url
            };
        } catch (error: any) {
            return { error: error.message };
        }
    }
};
