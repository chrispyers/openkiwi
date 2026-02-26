import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';

// Mock child_process before importing the tool
vi.mock('node:child_process', () => ({
    execFile: vi.fn()
}));

const mockedExecFile = vi.mocked(execFile);

// Import tool (module-level env reads only affect description, handler re-reads at call time)
import tool from '../github.js';

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

describe('github tool', () => {
    beforeEach(() => {
        process.env.GH_TOKEN = 'ghp_test_token_123';
        process.env.GITHUB_ALLOWED_REPOS = 'owner/blog,owner/docs';
        process.env.GITHUB_ALLOWED_PATHS = 'content/blog,content/articles';
        vi.clearAllMocks();
    });

    describe('definition', () => {
        it('should export a valid tool definition', () => {
            expect(tool.definition.name).toBe('github');
            expect(tool.definition.parameters.type).toBe('object');
            expect(tool.definition.parameters.required).toContain('action');
            expect(tool.definition.parameters.required).toContain('repo');
            expect(tool.definition.parameters.required).toContain('path');
            expect(tool.definition.parameters.properties.action.enum).toEqual([
                'list', 'read', 'create', 'update'
            ]);
        });

        it('should not have enum constraint on repo', () => {
            expect(tool.definition.parameters.properties.repo.enum).toBeUndefined();
        });

        it('should have a handler function', () => {
            expect(typeof tool.handler).toBe('function');
        });
    });

    describe('validation', () => {
        it('should reject when GH_TOKEN is missing', async () => {
            delete process.env.GH_TOKEN;
            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: 'content/blog'
            });
            expect(result.error).toMatch(/GH_TOKEN/);
        });

        it('should reject when GITHUB_ALLOWED_REPOS is empty', async () => {
            process.env.GITHUB_ALLOWED_REPOS = '';
            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: 'content/blog'
            });
            expect(result.error).toMatch(/allowed repositories/i);
        });

        it('should reject a repo not in the allowed list', async () => {
            const result = await tool.handler({
                action: 'list', repo: 'hacker/evil', path: 'content/blog'
            });
            expect(result.error).toMatch(/not in the allowed list/);
        });

        it('should reject a path not in allowed prefixes', async () => {
            const result = await tool.handler({
                action: 'read', repo: 'owner/blog', path: 'secrets/keys.txt'
            });
            expect(result.error).toMatch(/not within allowed prefixes/);
        });

        it('should allow root list even with path restrictions', async () => {
            mockGhSuccess([{ name: 'content', path: 'content', type: 'dir', size: 0 }]);
            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: '/'
            });
            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should require content for create action', async () => {
            const result = await tool.handler({
                action: 'create', repo: 'owner/blog', path: 'content/blog/post.md',
                message: 'Add post'
            });
            expect(result.error).toMatch(/"content" is required/);
        });

        it('should require message for create action', async () => {
            const result = await tool.handler({
                action: 'create', repo: 'owner/blog', path: 'content/blog/post.md',
                content: '# Hello'
            });
            expect(result.error).toMatch(/"message".*required/);
        });

        it('should require content for update action', async () => {
            const result = await tool.handler({
                action: 'update', repo: 'owner/blog', path: 'content/blog/post.md',
                message: 'Update post'
            });
            expect(result.error).toMatch(/"content" is required/);
        });

        it('should require message for update action', async () => {
            const result = await tool.handler({
                action: 'update', repo: 'owner/blog', path: 'content/blog/post.md',
                content: '# Updated'
            });
            expect(result.error).toMatch(/"message".*required/);
        });
    });

    describe('toolConfig (per-agent config)', () => {
        it('should use toolConfig repos when provided', async () => {
            // Clear env vars to prove toolConfig is used
            delete process.env.GITHUB_ALLOWED_REPOS;
            delete process.env.GITHUB_ALLOWED_PATHS;

            mockGhSuccess([{ name: 'README.md', path: 'README.md', type: 'file', size: 100 }]);

            const result = await tool.handler({
                action: 'list',
                repo: 'custom/repo',
                path: '/',
                _context: {
                    agentId: 'test-agent',
                    toolConfig: {
                        repos: { 'custom/repo': [] }
                    }
                }
            });

            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should use per-repo allowed paths from toolConfig repos', async () => {
            delete process.env.GITHUB_ALLOWED_REPOS;
            delete process.env.GITHUB_ALLOWED_PATHS;

            const result = await tool.handler({
                action: 'read',
                repo: 'custom/repo',
                path: 'secrets/keys.txt',
                _context: {
                    agentId: 'test-agent',
                    toolConfig: {
                        repos: { 'custom/repo': ['docs'] }
                    }
                }
            });

            expect(result.error).toMatch(/not within allowed prefixes/);
        });

        it('should reject repo not in toolConfig repos', async () => {
            const result = await tool.handler({
                action: 'list',
                repo: 'hacker/evil',
                path: '/',
                _context: {
                    agentId: 'test-agent',
                    toolConfig: {
                        repos: { 'owner/blog': [] }
                    }
                }
            });

            expect(result.error).toMatch(/not in the allowed list/);
        });

        it('should fall back to env vars when no toolConfig provided', async () => {
            // env vars are set in beforeEach
            mockGhSuccess([{ name: 'post.md', path: 'content/blog/post.md', type: 'file', size: 50 }]);

            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: 'content/blog'
            });

            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should fall back to env vars when toolConfig is empty', async () => {
            mockGhSuccess([{ name: 'post.md', path: 'content/blog/post.md', type: 'file', size: 50 }]);

            const result = await tool.handler({
                action: 'list',
                repo: 'owner/blog',
                path: 'content/blog',
                _context: { agentId: 'test-agent' }
            });

            expect(result.error).toBeUndefined();
            expect(result.files).toBeDefined();
        });

        it('should allow all paths when repo has empty paths array', async () => {
            delete process.env.GITHUB_ALLOWED_REPOS;
            delete process.env.GITHUB_ALLOWED_PATHS;

            const fileContent = '# Secret';
            const encoded = Buffer.from(fileContent).toString('base64');
            mockGhSuccess({ type: 'file', content: encoded, sha: 'abc', size: 8 });

            const result = await tool.handler({
                action: 'read',
                repo: 'custom/repo',
                path: 'any/path/file.md',
                _context: {
                    agentId: 'test-agent',
                    toolConfig: {
                        repos: { 'custom/repo': [] }
                    }
                }
            });

            expect(result.error).toBeUndefined();
            expect(result.content).toBe(fileContent);
        });
    });

    describe('list action', () => {
        it('should list directory contents', async () => {
            const apiResponse = [
                { name: 'post1.md', path: 'content/blog/post1.md', type: 'file', size: 1234 },
                { name: 'post2.md', path: 'content/blog/post2.md', type: 'file', size: 5678 },
                { name: 'images', path: 'content/blog/images', type: 'dir', size: 0 }
            ];
            mockGhSuccess(apiResponse);

            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: 'content/blog'
            });

            expect(result.repo).toBe('owner/blog');
            expect(result.path).toBe('content/blog');
            expect(result.files).toHaveLength(3);
            expect(result.files[0]).toEqual({
                name: 'post1.md', path: 'content/blog/post1.md', type: 'file', size: 1234
            });
        });

        it('should call gh api with correct endpoint', async () => {
            mockGhSuccess([]);
            await tool.handler({ action: 'list', repo: 'owner/blog', path: 'content/blog' });

            const args = getGhArgs();
            expect(args).toContain('api');
            expect(args).toContain('/repos/owner/blog/contents/content/blog');
        });

        it('should error if path is not a directory', async () => {
            mockGhSuccess({ type: 'file', name: 'post.md' }); // not an array
            const result = await tool.handler({
                action: 'list', repo: 'owner/blog', path: 'content/blog/post.md'
            });
            expect(result.error).toMatch(/not.*directory/i);
        });
    });

    describe('read action', () => {
        it('should read and decode file content', async () => {
            const fileContent = '# My Blog Post\n\nHello world!';
            const encoded = Buffer.from(fileContent).toString('base64');
            mockGhSuccess({
                type: 'file',
                content: encoded,
                sha: 'abc123',
                size: fileContent.length
            });

            const result = await tool.handler({
                action: 'read', repo: 'owner/blog', path: 'content/blog/post.md'
            });

            expect(result.content).toBe(fileContent);
            expect(result.sha).toBe('abc123');
            expect(result.repo).toBe('owner/blog');
            expect(result.path).toBe('content/blog/post.md');
        });

        it('should error if path is a directory, not a file', async () => {
            mockGhSuccess({ type: 'dir', name: 'blog' });
            const result = await tool.handler({
                action: 'read', repo: 'owner/blog', path: 'content/blog'
            });
            expect(result.error).toMatch(/not a file/);
        });
    });

    describe('create action', () => {
        it('should create a new file', async () => {
            let callCount = 0;
            mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
                if (typeof _opts === 'function') callback = _opts;
                callCount++;
                if (callCount === 1) {
                    // File doesn't exist — 404
                    const err: any = new Error('HTTP 404');
                    err.stderr = 'HTTP 404';
                    callback(err, { stdout: '', stderr: 'HTTP 404' });
                } else {
                    // Create succeeds
                    callback(null, {
                        stdout: JSON.stringify({
                            content: { sha: 'new_sha_123' },
                            commit: { sha: 'commit_sha_456' }
                        }),
                        stderr: ''
                    });
                }
                return {} as any;
            });

            const result = await tool.handler({
                action: 'create',
                repo: 'owner/blog',
                path: 'content/blog/new-post.md',
                content: '# New Post',
                message: 'Add new blog post'
            });

            expect(result.action).toBe('created');
            expect(result.sha).toBe('new_sha_123');
            expect(result.commit).toBe('commit_sha_456');

            // Verify the PUT call has --method PUT and -f flags
            const putArgs = getGhArgs(1);
            expect(putArgs).toContain('--method');
            expect(putArgs).toContain('PUT');
        });

        it('should reject if file already exists', async () => {
            mockGhSuccess({ type: 'file', sha: 'existing' });
            const result = await tool.handler({
                action: 'create',
                repo: 'owner/blog',
                path: 'content/blog/existing.md',
                content: '# Hello',
                message: 'Add post'
            });
            expect(result.error).toMatch(/already exists/);
        });

        it('should base64-encode content for create', async () => {
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
                        stdout: JSON.stringify({ content: { sha: 'x' }, commit: { sha: 'y' } }),
                        stderr: ''
                    });
                }
                return {} as any;
            });

            await tool.handler({
                action: 'create',
                repo: 'owner/blog',
                path: 'content/blog/post.md',
                content: '# Test Content',
                message: 'test'
            });

            const putArgs = getGhArgs(1);
            const contentArg = putArgs.find((a: string) => a.startsWith('content='));
            expect(contentArg).toBeDefined();
            // Decode and verify
            const encoded = contentArg!.replace('content=', '');
            expect(Buffer.from(encoded, 'base64').toString('utf-8')).toBe('# Test Content');
        });
    });

    describe('update action', () => {
        it('should update an existing file with its SHA', async () => {
            let callCount = 0;
            mockedExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback?: any) => {
                if (typeof _opts === 'function') callback = _opts;
                callCount++;
                if (callCount === 1) {
                    // File exists — return current SHA
                    callback(null, {
                        stdout: JSON.stringify({ sha: 'old_sha_789', type: 'file' }),
                        stderr: ''
                    });
                } else {
                    // Update succeeds
                    callback(null, {
                        stdout: JSON.stringify({
                            content: { sha: 'updated_sha_abc' },
                            commit: { sha: 'commit_sha_def' }
                        }),
                        stderr: ''
                    });
                }
                return {} as any;
            });

            const result = await tool.handler({
                action: 'update',
                repo: 'owner/blog',
                path: 'content/blog/post.md',
                content: '# Updated Post',
                message: 'Update blog post'
            });

            expect(result.action).toBe('updated');
            expect(result.sha).toBe('updated_sha_abc');
            expect(result.commit).toBe('commit_sha_def');

            // Verify SHA was passed in the PUT
            const putArgs = getGhArgs(1);
            expect(putArgs.some((a: string) => a.includes('old_sha_789'))).toBe(true);
        });

        it('should reject if file does not exist', async () => {
            mockGhError('HTTP 404');
            const result = await tool.handler({
                action: 'update',
                repo: 'owner/blog',
                path: 'content/blog/missing.md',
                content: '# Updated',
                message: 'Update post'
            });
            expect(result.error).toMatch(/not found/);
        });
    });

    describe('gh CLI invocation', () => {
        it('should use execFile (not shell) for safety', async () => {
            mockGhSuccess([]);
            await tool.handler({ action: 'list', repo: 'owner/blog', path: 'content/blog' });

            const call = mockedExecFile.mock.calls[0];
            expect(call[0]).toBe('gh');
        });

        it('should strip leading slashes from paths', async () => {
            mockGhSuccess([]);
            await tool.handler({ action: 'list', repo: 'owner/blog', path: '/content/blog' });

            const args = getGhArgs();
            const endpoint = args.find((a: string) => a.startsWith('/repos/'));
            expect(endpoint).toBe('/repos/owner/blog/contents/content/blog');
        });

        it('should handle gh CLI errors gracefully', async () => {
            mockGhError('gh: Not Found (HTTP 404)');
            const result = await tool.handler({
                action: 'read', repo: 'owner/blog', path: 'content/blog/nope.md'
            });
            expect(result.error).toMatch(/failed/i);
        });
    });

    describe('unknown action', () => {
        it('should reject unknown actions', async () => {
            const result = await tool.handler({
                action: 'delete' as any,
                repo: 'owner/blog',
                path: 'content/blog/post.md'
            });
            expect(result.error).toMatch(/Unknown action/);
        });
    });
});
