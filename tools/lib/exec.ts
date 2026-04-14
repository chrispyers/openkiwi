import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecResult {
    stdout: string;
    stderr: string;
    error?: string;
    /** Exit code — only set on failure. Useful for commands like grep/find that use code 1 to mean "no results". */
    code?: number;
}

// Build an augmented PATH that includes common user binary locations.
// When the server starts as a daemon/service, the inherited PATH often lacks
// ~/.local/bin, ~/.npm-global/bin, etc., causing tools like `claude` to be
// not found even though they're installed.
function buildEnhancedPath(): string {
    const home = process.env.HOME || '';
    const extra = [
        `${home}/.local/bin`,
        `${home}/.npm-global/bin`,
        `${home}/.cargo/bin`,
        '/usr/local/bin',
        '/opt/homebrew/bin',
    ].filter(Boolean);
    const existing = process.env.PATH || '';
    const parts = existing.split(':').filter(Boolean);
    for (const p of extra) {
        if (!parts.includes(p)) parts.unshift(p);
    }
    return parts.join(':');
}

const ENHANCED_PATH = buildEnhancedPath();

export async function execInWorkspace(
    command: string,
    cwd: string,
    options: { timeout?: number; maxBuffer?: number } = {}
): Promise<ExecResult> {
    const { timeout = 30_000, maxBuffer = 10 * 1024 * 1024 } = options;
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout,
            maxBuffer,
            env: { ...process.env, PATH: ENHANCED_PATH },
        });
        return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (e: any) {
        return {
            stdout: e.stdout ? e.stdout.toString().trim() : '',
            stderr: e.stderr ? e.stderr.toString().trim() : '',
            error: e.message,
            code: e.code
        };
    }
}
