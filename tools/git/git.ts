import { resolveWorkspacePath, WORKSPACE_DIR } from '../lib/workspace.js';
import { execInWorkspace } from '../lib/exec.js';

interface GitConnection {
    id: string;
    label: string;
    baseUrl: string;
    pat?: string;
}

/**
 * Inject oauth2:<pat>@ credentials into a git clone URL.
 *
 * Handles three forms of the repo argument inside a clone command:
 *   1. Full HTTPS URL matching the connection host  →  inject credentials
 *   2. Bare path  (/owner/repo  or  owner/repo)    →  prepend connection base URL + credentials
 *   3. Anything else                               →  pass through unchanged with a warning
 */
function injectCredentials(args: string, baseUrl: string, pat: string): string {
    const base = baseUrl.replace(/\/$/, '');
    const host = base.replace(/^https?:\/\//, '');
    const encodedPat = encodeURIComponent(pat);
    const authBase = `https://oauth2:${encodedPat}@${host}`;

    // Case 1: a full HTTPS URL for this host is already in args
    const hostEscaped = host.replace(/\./g, '\\.');
    const httpsRx = new RegExp(`https://(?:[^@\\s]*@)?${hostEscaped}(/[^\\s]*)?`);
    if (httpsRx.test(args)) {
        return args.replace(httpsRx, (_, path) => `${authBase}${path ?? ''}`);
    }

    // Case 2: clone with a bare path — /owner/repo or owner/repo
    const cloneRx = /^(clone\s+)(\/[^\s]+|[a-zA-Z0-9_][a-zA-Z0-9_.\-/]*\/[a-zA-Z0-9_.\-]+)((?:\s+.*)?)$/;
    const m = args.match(cloneRx);
    if (m) {
        const [, cmd, repoPath, rest] = m;
        const fullPath = repoPath.startsWith('/') ? repoPath : `/${repoPath}`;
        const repoUrl = `${authBase}${fullPath}${fullPath.endsWith('.git') ? '' : '.git'}`;
        return `${cmd}${repoUrl}${rest}`;
    }

    // Case 3: unrecognised form — pass through and let git report the error
    console.warn(`[git] connection "${baseUrl}" specified but could not inject credentials into args: ${args}`);
    return args;
}

export default {
    definition: {
        name: 'git',
        displayName: 'Git',
        pluginType: 'tool',
        description:
            'Run any git command inside the workspace (e.g. clone, log, diff, status). ' +
            'Use the optional `connection` parameter to authenticate with a named git connection ' +
            'configured in Settings > Connections (e.g. "GitHub" or "GitLab"). ' +
            'When cloning via a connection you may supply a bare repository path ' +
            '(e.g. "/my_group/my_project") instead of a full URL.',
        requiresApproval: true,
        verificationHint: 'After cloning, verify repos exist by calling ls on the parent directory (e.g. ls path="tmp") and confirming each expected repo name appears in the listing. Do not use glob with paths containing "/".',
        parameters: {
            type: 'object',
            properties: {
                args: {
                    type: 'string',
                    description:
                        'Git arguments exactly as you would type them after "git " ' +
                        '(e.g. "clone https://github.com/owner/repo --depth 1", ' +
                        '"clone /owner/repo dest-folder", "log --oneline -10", "status"). ' +
                        'When using a `connection`, a bare path like "/owner/repo" is accepted ' +
                        'in place of a full URL — the base URL is resolved from the connection config.'
                },
                cwd: {
                    type: 'string',
                    description: 'Working directory relative to the workspace root. Defaults to workspace root.'
                },
                connection: {
                    type: 'string',
                    description:
                        'Name of a configured git connection to use for PAT authentication ' +
                        '(e.g. "GitHub", "GitLab"). Credentials are injected automatically — ' +
                        'do NOT embed tokens in the URL when using this parameter.'
                }
            },
            required: ['args']
        }
    },

    handler: async ({
        args,
        cwd = '',
        connection,
        _context
    }: {
        args: string;
        cwd?: string;
        connection?: string;
        _context?: { agentId?: string; connections?: { git: GitConnection[] } };
    }) => {
        if (!args || typeof args !== 'string') {
            return { error: 'Missing required parameter: args must be a non-empty string.' };
        }

        const { safe } = resolveWorkspacePath(cwd);
        const targetDir = safe || WORKSPACE_DIR;

        let effectiveArgs = args;

        if (connection) {
            const gitConns = _context?.connections?.git ?? [];
            const conn = gitConns.find(
                c => c.label.toLowerCase() === connection.toLowerCase() ||
                    c.id.toLowerCase() === connection.toLowerCase()
            );
            if (!conn) {
                const available = gitConns.map(c => c.label).join(', ') || 'none configured';
                return { error: `Git connection "${connection}" not found. Available connections: ${available}` };
            }
            if (!conn.pat) {
                return { error: `Git connection "${conn.label}" has no PAT configured. Add one in Settings > Connections.` };
            }
            effectiveArgs = injectCredentials(args, conn.baseUrl, conn.pat);
        }

        const command = `git ${effectiveArgs}`;
        // Always log the original args (without injected credentials)
        console.log(`[git] Executing \`git ${args}\` in ${targetDir}`);

        const result = await execInWorkspace(command, targetDir, { timeout: 120_000 });

        if (result.error) {
            return {
                error: `git ${args.split(' ')[0]} failed: ${result.stderr || result.error}`,
                stdout: result.stdout,
                stderr: result.stderr
            };
        }
        return { stdout: result.stdout, stderr: result.stderr };
    }
};
