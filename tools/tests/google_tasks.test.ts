import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock googleapis before importing the tool
const mockTasklistsList = vi.fn();
const mockTasksList = vi.fn();
const mockTasksInsert = vi.fn();
const mockTasksPatch = vi.fn();

vi.mock('googleapis', () => ({
    google: {
        auth: {
            OAuth2: vi.fn().mockImplementation(function () {
                this.setCredentials = vi.fn();
            })
        },
        tasks: vi.fn().mockImplementation(function () {
            return {
                tasklists: { list: mockTasklistsList },
                tasks: {
                    list: mockTasksList,
                    insert: mockTasksInsert,
                    patch: mockTasksPatch
                }
            };
        })
    }
}));

import tool from '../google_tasks/google_tasks.js';

const handler = tool.handler;

describe('google_tasks tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
        process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token';
    });

    describe('definition', () => {
        it('has correct name and actions', () => {
            expect(tool.definition.name).toBe('google_tasks');
            const actionEnum = tool.definition.parameters.properties.action.enum;
            expect(actionEnum).toEqual(['list_tasklists', 'list_tasks', 'add_task', 'update_task']);
        });

        it('does not include a delete action', () => {
            const actionEnum = tool.definition.parameters.properties.action.enum;
            expect(actionEnum).not.toContain('delete_task');
        });
    });

    describe('credential validation', () => {
        it('returns error when GOOGLE_CLIENT_ID is missing', async () => {
            delete process.env.GOOGLE_CLIENT_ID;
            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({ error: expect.stringContaining('Missing Google credentials') });
        });

        it('returns error when GOOGLE_CLIENT_SECRET is missing', async () => {
            delete process.env.GOOGLE_CLIENT_SECRET;
            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({ error: expect.stringContaining('Missing Google credentials') });
        });

        it('returns error when GOOGLE_REFRESH_TOKEN is missing', async () => {
            delete process.env.GOOGLE_REFRESH_TOKEN;
            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({ error: expect.stringContaining('Missing Google credentials') });
        });
    });

    describe('list_tasklists', () => {
        it('returns formatted task lists', async () => {
            mockTasklistsList.mockResolvedValue({
                data: {
                    items: [
                        { id: 'tl1', title: 'My Tasks', kind: 'tasks#taskList' },
                        { id: 'tl2', title: 'Work', kind: 'tasks#taskList' }
                    ]
                }
            });

            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({
                tasklists: [
                    { id: 'tl1', title: 'My Tasks' },
                    { id: 'tl2', title: 'Work' }
                ]
            });
        });

        it('returns empty array when no task lists exist', async () => {
            mockTasklistsList.mockResolvedValue({ data: { items: undefined } });
            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({ tasklists: [] });
        });
    });

    describe('list_tasks', () => {
        it('returns error when tasklist_id is missing', async () => {
            const result = await handler({ action: 'list_tasks' });
            expect(result).toEqual({ error: 'tasklist_id is required for list_tasks' });
        });

        it('returns formatted tasks', async () => {
            mockTasksList.mockResolvedValue({
                data: {
                    items: [
                        { id: 't1', title: 'Buy milk', notes: 'Oat milk', status: 'needsAction', due: '2026-03-01T00:00:00.000Z' },
                        { id: 't2', title: 'Call dentist', status: 'completed' }
                    ]
                }
            });

            const result = await handler({ action: 'list_tasks', tasklist_id: 'tl1' });
            expect(result).toEqual({
                tasks: [
                    { id: 't1', title: 'Buy milk', notes: 'Oat milk', status: 'needsAction', due: '2026-03-01T00:00:00.000Z' },
                    { id: 't2', title: 'Call dentist', notes: null, status: 'completed', due: null }
                ]
            });
        });
    });

    describe('add_task', () => {
        it('returns error when tasklist_id is missing', async () => {
            const result = await handler({ action: 'add_task', title: 'Test' });
            expect(result).toEqual({ error: 'tasklist_id is required for add_task' });
        });

        it('returns error when title is missing', async () => {
            const result = await handler({ action: 'add_task', tasklist_id: 'tl1' });
            expect(result).toEqual({ error: 'title is required for add_task' });
        });

        it('creates a task and returns it', async () => {
            mockTasksInsert.mockResolvedValue({
                data: { id: 't3', title: 'New task', status: 'needsAction', due: null }
            });

            const result = await handler({ action: 'add_task', tasklist_id: 'tl1', title: 'New task' });
            expect(result).toEqual({
                created: { id: 't3', title: 'New task', status: 'needsAction', due: null }
            });
        });

        it('converts YYYY-MM-DD due date to RFC 3339', async () => {
            mockTasksInsert.mockResolvedValue({
                data: { id: 't4', title: 'With date', status: 'needsAction', due: '2026-04-15T00:00:00.000Z' }
            });

            await handler({ action: 'add_task', tasklist_id: 'tl1', title: 'With date', due: '2026-04-15' });

            expect(mockTasksInsert).toHaveBeenCalledWith({
                tasklist: 'tl1',
                requestBody: {
                    title: 'With date',
                    due: '2026-04-15T00:00:00.000Z'
                }
            });
        });

        it('passes notes when provided', async () => {
            mockTasksInsert.mockResolvedValue({
                data: { id: 't5', title: 'Noted', status: 'needsAction', due: null }
            });

            await handler({ action: 'add_task', tasklist_id: 'tl1', title: 'Noted', notes: 'Some details' });

            expect(mockTasksInsert).toHaveBeenCalledWith({
                tasklist: 'tl1',
                requestBody: {
                    title: 'Noted',
                    notes: 'Some details'
                }
            });
        });
    });

    describe('update_task', () => {
        it('returns error when tasklist_id is missing', async () => {
            const result = await handler({ action: 'update_task', task_id: 't1' });
            expect(result).toEqual({ error: 'tasklist_id is required for update_task' });
        });

        it('returns error when task_id is missing', async () => {
            const result = await handler({ action: 'update_task', tasklist_id: 'tl1' });
            expect(result).toEqual({ error: 'task_id is required for update_task' });
        });

        it('updates a task using patch', async () => {
            mockTasksPatch.mockResolvedValue({
                data: { id: 't1', title: 'Updated', status: 'completed', due: null }
            });

            const result = await handler({
                action: 'update_task',
                tasklist_id: 'tl1',
                task_id: 't1',
                title: 'Updated',
                status: 'completed'
            });

            expect(mockTasksPatch).toHaveBeenCalledWith({
                tasklist: 'tl1',
                task: 't1',
                requestBody: { title: 'Updated', status: 'completed' }
            });
            expect(result).toEqual({
                updated: { id: 't1', title: 'Updated', status: 'completed', due: null }
            });
        });

        it('converts due date in update', async () => {
            mockTasksPatch.mockResolvedValue({
                data: { id: 't1', title: 'Task', status: 'needsAction', due: '2026-05-01T00:00:00.000Z' }
            });

            await handler({
                action: 'update_task',
                tasklist_id: 'tl1',
                task_id: 't1',
                due: '2026-05-01'
            });

            expect(mockTasksPatch).toHaveBeenCalledWith({
                tasklist: 'tl1',
                task: 't1',
                requestBody: { due: '2026-05-01T00:00:00.000Z' }
            });
        });
    });

    describe('error handling', () => {
        it('returns error object on API failure', async () => {
            mockTasklistsList.mockRejectedValue(new Error('API quota exceeded'));
            const result = await handler({ action: 'list_tasklists' });
            expect(result).toEqual({ error: 'API quota exceeded' });
        });
    });
});
