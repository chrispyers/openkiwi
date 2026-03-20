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

export async function execInWorkspace(
    command: string,
    cwd: string,
    options: { timeout?: number; maxBuffer?: number } = {}
): Promise<ExecResult> {
    const { timeout = 30_000, maxBuffer = 10 * 1024 * 1024 } = options;
    try {
        const { stdout, stderr } = await execAsync(command, { cwd, timeout, maxBuffer });
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
