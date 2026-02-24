import path from 'node:path';
import fs from 'node:fs';
import { SCREENSHOTS_DIR, WORKSPACE_DIR } from './security.js';

/**
 * Helper to extract text and images from messages to provide vision context
 */
export function processVisionMessages(messages: any[], supportsVision: boolean = true): any[] {
    if (!supportsVision) return messages;

    const processed = [...messages];
    const hoistedImages: any[] = [];
    let lastUserIndex = -1;

    // Helper to resolve and encode image to base64
    const getBase64Image = (url: string): string | null => {
        try {
            if (url.startsWith('data:')) return url;
            if (url.startsWith('http')) return url;

            // Handle both legacy paths and new authenticated proxy paths
            let cleanUrl = url.replace(/^\/?api\/files\//, '/'); // Normalize proxy path
            cleanUrl = cleanUrl.split('?')[0]; // Strip token

            const relativePath = cleanUrl.replace(/^\/?(screenshots|workspace-files)\//, '');
            const isScreenshot = cleanUrl.includes('screenshots');

            let fullPath = path.resolve(isScreenshot ? SCREENSHOTS_DIR : WORKSPACE_DIR, relativePath);

            if (!fs.existsSync(fullPath)) {
                // Try the other directory just in case
                fullPath = path.resolve(!isScreenshot ? SCREENSHOTS_DIR : WORKSPACE_DIR, relativePath);
                if (!fs.existsSync(fullPath)) {
                    // Fallback to basename
                    const filename = path.basename(cleanUrl);
                    fullPath = path.join(SCREENSHOTS_DIR, filename);
                    if (!fs.existsSync(fullPath)) {
                        fullPath = path.join(WORKSPACE_DIR, filename);
                    }
                }
            }

            if (fs.existsSync(fullPath)) {
                const base64 = fs.readFileSync(fullPath, 'base64');
                return `data:image/png;base64,${base64}`;
            }
        } catch (e) {
            console.error(`[Vision] Failed to resolve image ${url}:`, e);
        }
        return null;
    };

    // First pass: Process all messages and collect images to hoist
    for (let i = 0; i < processed.length; i++) {
        const msg = { ...processed[i] }; // Shallow copy
        if (typeof msg.content !== 'string' || !msg.content) {
            if (msg.role === 'user') lastUserIndex = i;
            continue;
        }

        const content = msg.content;

        // 1. Extract images from current message
        const currentImages: any[] = [];

        // Check for JSON tool result
        if (msg.role === 'tool') {
            try {
                const data = JSON.parse(content);
                const url = data.screenshot_url || data.image_url || data.image;
                if (url && typeof url === 'string') {
                    const b64 = getBase64Image(url);
                    if (b64) currentImages.push({ type: 'image_url', image_url: { url: b64 } });
                }
            } catch (e) { /* Not JSON */ }
        }

        // Check for Markdown images
        const imgRegex = /!\[.*?\]\((.*?)\)/g;
        const matches = [...content.matchAll(imgRegex)];
        for (const match of matches) {
            const b64 = getBase64Image(match[1]);
            if (b64) currentImages.push({ type: 'image_url', image_url: { url: b64 } });
        }

        if (msg.role === 'user') {
            lastUserIndex = i;
            // For user messages, we convert string content to array content in-place if images found
            if (currentImages.length > 0) {
                processed[i] = {
                    ...msg,
                    content: [
                        { type: 'text', text: content },
                        ...currentImages
                    ]
                };
            }
        } else {
            // For assistant/tool messages, we HOIST images to the context of the user turn
            // to satisfy strict "alternate user/assistant roles" requirements of some providers (like LM Studio)
            hoistedImages.push(...currentImages);
        }
    }

    // Second pass: Inject hoisted images into the last user turn
    if (hoistedImages.length > 0 && lastUserIndex !== -1) {
        const userMsg = { ...processed[lastUserIndex] };
        const existingContent = Array.isArray(userMsg.content)
            ? [...userMsg.content]
            : [{ type: 'text', text: userMsg.content || '' }];

        // Check for duplicates before adding
        const uniqueHoisted = hoistedImages.filter(hi =>
            !existingContent.some((c: any) => c.type === 'image_url' && c.image_url?.url === hi.image_url?.url)
        );

        if (uniqueHoisted.length > 0) {
            processed[lastUserIndex] = {
                ...userMsg,
                content: [...existingContent, ...uniqueHoisted]
            };
        }
    }

    return processed;
}
