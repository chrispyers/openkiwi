import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import tool from '../google_tasks.js';

// Load .env into process.env for integration tests
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const handler = tool.handler;

const hasCredentials = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
);

// Track resources to clean up
let testTasklistId: string;
let createdTaskId: string;

// Direct API client for cleanup (delete isn't exposed by the tool)
function getApiClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.tasks({ version: 'v1', auth: oauth2Client });
}

describe.runIf(hasCredentials)('google_tasks integration', () => {
    afterAll(async () => {
        // Clean up: delete the test task we created
        if (testTasklistId && createdTaskId) {
            try {
                const api = getApiClient();
                await api.tasks.delete({ tasklist: testTasklistId, task: createdTaskId });
            } catch {
                // Best-effort cleanup
            }
        }
    });

    it('list_tasklists returns at least one task list', async () => {
        const result = await handler({ action: 'list_tasklists' }) as any;

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('tasklists');
        expect(Array.isArray(result.tasklists)).toBe(true);
        expect(result.tasklists.length).toBeGreaterThan(0);

        // Every task list has id and title
        for (const tl of result.tasklists) {
            expect(tl).toHaveProperty('id');
            expect(tl).toHaveProperty('title');
            expect(typeof tl.id).toBe('string');
            expect(typeof tl.title).toBe('string');
        }

        // Save the first task list for subsequent tests
        testTasklistId = result.tasklists[0].id;
    });

    it('list_tasks returns tasks array for a task list', async () => {
        const result = await handler({ action: 'list_tasks', tasklist_id: testTasklistId }) as any;

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('tasks');
        expect(Array.isArray(result.tasks)).toBe(true);

        // If there are tasks, verify their shape
        for (const t of result.tasks) {
            expect(t).toHaveProperty('id');
            expect(t).toHaveProperty('title');
            expect(t).toHaveProperty('status');
            expect(['needsAction', 'completed']).toContain(t.status);
        }
    });

    it('add_task creates a task with title, notes, and due date', async () => {
        const result = await handler({
            action: 'add_task',
            tasklist_id: testTasklistId,
            title: '[TEST] Integration test task',
            notes: 'Created by google_tasks integration test — safe to delete',
            due: '2026-12-31'
        }) as any;

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('created');
        expect(result.created.title).toBe('[TEST] Integration test task');
        expect(result.created.status).toBe('needsAction');
        expect(result.created.due).toBe('2026-12-31T00:00:00.000Z');
        expect(typeof result.created.id).toBe('string');

        createdTaskId = result.created.id;
    });

    it('list_tasks includes the newly created task', async () => {
        const result = await handler({ action: 'list_tasks', tasklist_id: testTasklistId }) as any;

        expect(result).not.toHaveProperty('error');
        const found = result.tasks.find((t: any) => t.id === createdTaskId);
        expect(found).toBeDefined();
        expect(found.title).toBe('[TEST] Integration test task');
        expect(found.notes).toBe('Created by google_tasks integration test — safe to delete');
    });

    it('update_task can change title and mark completed', async () => {
        const result = await handler({
            action: 'update_task',
            tasklist_id: testTasklistId,
            task_id: createdTaskId,
            title: '[TEST] Updated integration task',
            status: 'completed'
        }) as any;

        expect(result).not.toHaveProperty('error');
        expect(result).toHaveProperty('updated');
        expect(result.updated.id).toBe(createdTaskId);
        expect(result.updated.title).toBe('[TEST] Updated integration task');
        expect(result.updated.status).toBe('completed');
    });

    it('update_task can change due date', async () => {
        const result = await handler({
            action: 'update_task',
            tasklist_id: testTasklistId,
            task_id: createdTaskId,
            due: '2027-01-15'
        }) as any;

        expect(result).not.toHaveProperty('error');
        expect(result.updated.due).toBe('2027-01-15T00:00:00.000Z');
    });

    it('list_tasks reflects the updates', async () => {
        const result = await handler({ action: 'list_tasks', tasklist_id: testTasklistId }) as any;

        expect(result).not.toHaveProperty('error');
        const found = result.tasks.find((t: any) => t.id === createdTaskId);
        expect(found).toBeDefined();
        expect(found.title).toBe('[TEST] Updated integration task');
        expect(found.status).toBe('completed');
        expect(found.due).toBe('2027-01-15T00:00:00.000Z');
    });
});
