import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';

// Mock child_process before importing tools
vi.mock('node:child_process', () => ({
    execFile: vi.fn()
}));

const mockedExecFile = vi.mocked(execFile);

// Import individual tools
import listTool from '../github/github_list.js';
import readTool from '../github/github_read.js';
import createTool from '../github/github_create.js';
import updateTool from '../github/github_update.js';
import gistReadTool from '../github/github_gist_read.js';

// Helper: make execFile resolve with given stdout
function mockGhSuccess(stdout: string | object) {
    const json = typeof stdout === 'string' ? stdout : JSON.stringify(stdout);
    mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
        if (typeof _opts === 'function') {
            callback = _opts;
        }
        if (callback) {
            callback(null, { stdout: json, stderr: '' });
        }
        return {} as any;
    });
}

// Helper: make execFile fail with given stderr
function mockGhError(stderr: string) {
    mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
        if (typeof _opts === 'function') callback = _opts;
        if (callback) {
            const err: any = new Error(`Command failed`);
            err.stderr = stderr;
            callback(err, { stdout: '', stderr });
        }
        return {} as any;
    });
}

// Helper: capture the args passed to execFile on the Nth call (0-indexed)
function getGhArgs(callIndex = 0): string[] {
    const call = mockedExecFile.mock.calls[callIndex];
    return call?.[1] as string[] ?? [];
}

describe('github tools', () => {
    beforeEach(() => {
        process.env.GH_TOKEN = 'ghp_test_token_123';
        process.env.GITHUB_ALLOWED_REPOS = 'owner/blog,owner/docs';
        process.env.GITHUB_ALLOWED_PATHS = 'content/blog,content/articles';
        vi.clearAllMocks();
    });

    describe('github_list', () => {
        it('should export a valid tool definition', () => {
            expect(listTool.definition.name).toBe('github_list');
            expect(listTool.definition.configKey).toBe('github');
            expect(listTool.definition.parameters.required).toContain('repo');
        });

        it('should list directory contents', async () => {
            const apiResponse = [
                { name: 'post1.md', path: 'content/blog/post1.md', type: 'file', size: 1234 },
                { name: 'post2.md', path: 'content/blog/post2.md', type: 'file', size: 5678 },
                { name: 'images', path: 'content/blog/images', type: 'dir', size: 0 }
            ];
            mockGhSuccess(apiResponse);

            const result = await listTool.handler({
                repo: 'owner/blog', path: 'content/blog'
            });

            expect(result.repo).toBe('owner/blog');
            expect(result.path).toBe('content/blog');
            expect(result.files).toHaveLength(3);
        });

        it('should reject when GH_TOKEN is missing', async () => {
            delete process.env.GH_TOKEN;
            const result = await listTool.handler({ repo: 'owner/blog', path: 'content/blog' });
            expect(result.error).toMatch(/GH_TOKEN/);
        });

        it('should reject a repo not in the allowed list', async () => {
            const result = await listTool.handler({ repo: 'hacker/evil', path: 'content/blog' });
            expect(result.error).toMatch(/not in the allowed list/);
        });

        it('should allow root list even with path restrictions', async () => {
            mockGhSuccess([{ name: 'content', path: 'content', type: 'dir', size: 0 }]);
            const result = await listTool.handler({ repo: 'owner/blog', path: '/' });
            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should error if path is not a directory', async () => {
            mockGhSuccess({ type: 'file', name: 'post.md' });
            const result = await listTool.handler({ repo: 'owner/blog', path: 'content/blog/post.md' });
            expect(result.error).toMatch(/not.*directory/i);
        });
    });

    describe('github_read', () => {
        it('should export a valid tool definition', () => {
            expect(readTool.definition.name).toBe('github_read');
            expect(readTool.definition.configKey).toBe('github');
            expect(readTool.definition.parameters.required).toContain('repo');
            expect(readTool.definition.parameters.required).toContain('path');
        });

        it('should read and decode file content', async () => {
            const fileContent = '# My Blog Post\n\nHello world!';
            const encoded = Buffer.from(fileContent).toString('base64');
            mockGhSuccess({ type: 'file', content: encoded, sha: 'abc123', size: fileContent.length });

            const result = await readTool.handler({ repo: 'owner/blog', path: 'content/blog/post.md' });

            expect(result.content).toBe(fileContent);
            expect(result.sha).toBe('abc123');
        });

        it('should reject a path not in allowed prefixes', async () => {
            const result = await readTool.handler({ repo: 'owner/blog', path: 'secrets/keys.txt' });
            expect(result.error).toMatch(/not within allowed prefixes/);
        });

        it('should error if path is a directory', async () => {
            mockGhSuccess({ type: 'dir', name: 'blog' });
            const result = await readTool.handler({ repo: 'owner/blog', path: 'content/blog' });
            expect(result.error).toMatch(/not a file/);
        });
    });

    describe('github_create', () => {
        it('should export a valid tool definition', () => {
            expect(createTool.definition.name).toBe('github_create');
            expect(createTool.definition.configKey).toBe('github');
            expect(createTool.definition.parameters.required).toEqual(['repo', 'path', 'content', 'message']);
        });

        it('should create a new file', async () => {
            let callCount = 0;
            mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
                if (typeof _opts === 'function') callback = _opts;
                callCount++;
                if (callCount === 1) {
                    const err: any = new Error('HTTP 404');
                    err.stderr = 'HTTP 404';
                    callback(err, { stdout: '', stderr: 'HTTP 404' });
                } else {
                    callback(null, {
                        stdout: JSON.stringify({ content: { sha: 'new_sha' }, commit: { sha: 'commit_sha' } }),
                        stderr: ''
                    });
                }
                return {} as any;
            });

            const result = await createTool.handler({
                repo: 'owner/blog', path: 'content/blog/new.md',
                content: '# New', message: 'Add post'
            });

            expect(result.action).toBe('created');
            expect(result.sha).toBe('new_sha');
        });

        it('should reject if file already exists', async () => {
            mockGhSuccess({ type: 'file', sha: 'existing' });
            const result = await createTool.handler({
                repo: 'owner/blog', path: 'content/blog/existing.md',
                content: '# Hello', message: 'Add post'
            });
            expect(result.error).toMatch(/already exists/);
        });
    });

    describe('github_update', () => {
        it('should export a valid tool definition', () => {
            expect(updateTool.definition.name).toBe('github_update');
            expect(updateTool.definition.configKey).toBe('github');
            expect(updateTool.definition.parameters.required).toEqual(['repo', 'path', 'content', 'message']);
        });

        it('should update an existing file with its SHA', async () => {
            let callCount = 0;
            mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
                if (typeof _opts === 'function') callback = _opts;
                callCount++;
                if (callCount === 1) {
                    callback(null, { stdout: JSON.stringify({ sha: 'old_sha', type: 'file' }), stderr: '' });
                } else {
                    callback(null, {
                        stdout: JSON.stringify({ content: { sha: 'new_sha' }, commit: { sha: 'commit_sha' } }),
                        stderr: ''
                    });
                }
                return {} as any;
            });

            const result = await updateTool.handler({
                repo: 'owner/blog', path: 'content/blog/post.md',
                content: '# Updated', message: 'Update post'
            });

            expect(result.action).toBe('updated');
            const putArgs = getGhArgs(1);
            expect(putArgs.some((a: string) => a.includes('old_sha'))).toBe(true);
        });

        it('should reject if file does not exist', async () => {
            mockGhError('HTTP 404');
            const result = await updateTool.handler({
                repo: 'owner/blog', path: 'content/blog/missing.md',
                content: '# Updated', message: 'Update'
            });
            expect(result.error).toMatch(/not found/);
        });
    });

    describe('github_gist_read', () => {
        it('should export a valid tool definition', () => {
            expect(gistReadTool.definition.name).toBe('github_gist_read');
            expect(gistReadTool.definition.parameters.required).toEqual(['gist_id']);
        });

        it('should read gist files', async () => {
            mockGhSuccess({
                owner: { login: 'testuser' },
                files: {
                    'schedule.md': { content: '# Schedule', size: 10, language: 'Markdown' }
                }
            });

            const result = await gistReadTool.handler({ gist_id: 'abc123' });

            expect(result.gist_id).toBe('abc123');
            expect(result.owner).toBe('testuser');
            expect(result.files).toHaveLength(1);
            expect(result.files[0].filename).toBe('schedule.md');
            expect(result.files[0].content).toBe('# Schedule');
        });

        it('should reject when GH_TOKEN is missing', async () => {
            delete process.env.GH_TOKEN;
            const result = await gistReadTool.handler({ gist_id: 'abc123' });
            expect(result.error).toMatch(/GH_TOKEN/);
        });
    });

    describe('toolConfig (per-agent config)', () => {
        it('should use toolConfig repos when provided', async () => {
            delete process.env.GITHUB_ALLOWED_REPOS;
            delete process.env.GITHUB_ALLOWED_PATHS;

            mockGhSuccess([{ name: 'README.md', path: 'README.md', type: 'file', size: 100 }]);

            const result = await listTool.handler({
                repo: 'custom/repo', path: '/',
                _context: { agentId: 'test', toolConfig: { repos: { 'custom/repo': [] } } }
            });

            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should use per-repo allowed paths from toolConfig', async () => {
            delete process.env.GITHUB_ALLOWED_REPOS;
            delete process.env.GITHUB_ALLOWED_PATHS;

            const result = await readTool.handler({
                repo: 'custom/repo', path: 'secrets/keys.txt',
                _context: { agentId: 'test', toolConfig: { repos: { 'custom/repo': ['docs'] } } }
            });

            expect(result.error).toMatch(/not within allowed prefixes/);
        });
    });

    describe('gh CLI safety', () => {
        it('should use execFile (not shell) for safety', async () => {
            mockGhSuccess([]);
            await listTool.handler({ repo: 'owner/blog', path: 'content/blog' });
            const call = mockedExecFile.mock.calls[0];
            expect(call[0]).toBe('gh');
        });

        it('should strip leading slashes from paths', async () => {
            mockGhSuccess([]);
            await listTool.handler({ repo: 'owner/blog', path: '/content/blog' });
            const args = getGhArgs();
            const endpoint = args.find((a: string) => a.startsWith('/repos/'));
            expect(endpoint).toBe('/repos/owner/blog/contents/content/blog');
        });

        it('should handle gh CLI errors gracefully', async () => {
            mockGhError('gh: Not Found (HTTP 404)');
            const result = await readTool.handler({ repo: 'owner/blog', path: 'content/blog/nope.md' });
            expect(result.error).toMatch(/failed/i);
        });
    });
});
