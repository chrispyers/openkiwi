import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEBUG = process.env.GITHUB_DEBUG === 'true' || process.env.GITHUB_DEBUG === '1';

export function debug(...args: unknown[]) {
    if (DEBUG) console.log('[GitHub:DEBUG]', ...args);
}

export async function ghApi(...args: string[]): Promise<any> {
    debug('gh api', args);
    try {
        const { stdout } = await execFileAsync('gh', ['api', ...args], {
            timeout: 30_000,
            maxBuffer: 10 * 1024 * 1024
        });
        debug('gh api response:', stdout.slice(0, 200) + (stdout.length > 200 ? '...' : ''));
        return JSON.parse(stdout);
    } catch (err: any) {
        const msg = err.stderr?.trim() || err.message;
        debug('gh api error:', msg);
        throw new Error(`gh api failed: ${msg}`);
    }
}

export function checkToken(): { error: string } | null {
    if (!process.env.GH_TOKEN) {
        return { error: 'GH_TOKEN environment variable is not set. Set GH_TOKEN in your .env file.' };
    }
    return null;
}

export interface ToolContext {
    agentId?: string;
    toolConfig?: { repos?: Record<string, string[] | { paths: string[] }> };
}

export function validateRepoAccess(
    repo: string,
    path: string,
    skipPathCheck: boolean,
    context?: ToolContext
): { error: string } | null {
    const reposConfig = context?.toolConfig?.repos;

    const allowedRepos = reposConfig
        ? Object.keys(reposConfig)
        : (process.env.GITHUB_ALLOWED_REPOS || '').split(',').map(r => r.trim()).filter(Boolean);

    if (allowedRepos.length === 0) {
        return { error: 'No allowed repositories configured. Set repos in tool config or GITHUB_ALLOWED_REPOS env var.' };
    }

    if (!allowedRepos.includes(repo)) {
        return { error: `Repository "${repo}" is not in the allowed list. Allowed: ${allowedRepos.join(', ')}` };
    }

    if (skipPathCheck) return null;

    const repoEntry = reposConfig?.[repo];
    const allowedPaths: string[] = reposConfig
        ? (Array.isArray(repoEntry) ? repoEntry : (repoEntry as any)?.paths ?? [])
        : (process.env.GITHUB_ALLOWED_PATHS || '').split(',').map(p => p.trim()).filter(Boolean);

    if (allowedPaths.length > 0) {
        const normalizedPath = path.replace(/^\//, '');
        const pathAllowed = allowedPaths.some((prefix) => normalizedPath.startsWith(prefix));
        if (!pathAllowed) {
            return { error: `Path "${path}" is not within allowed prefixes. Allowed: ${allowedPaths.join(', ')}` };
        }
    }

    return null;
}
