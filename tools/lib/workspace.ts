import * as path from 'path';

export const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

/**
 * Resolve an agent-supplied path to an absolute path within the workspace.
 * Returns { safe } on success, or { safe: '', error } if the resolved path
 * escapes the workspace sandbox.
 */
// Known container workspace prefix — normalised to a relative path before sandbox check
const CONTAINER_WORKSPACE = '/app/workspace';

export function resolveWorkspacePath(inputPath: string): { safe: string; error?: string } {
    // Strip a container-absolute prefix so the same path works whether the server
    // is running inside Docker (/app/workspace) or directly on the host.
    let normalized = inputPath;
    if (normalized === CONTAINER_WORKSPACE) {
        normalized = '.';
    } else if (normalized.startsWith(CONTAINER_WORKSPACE + path.sep)) {
        normalized = normalized.slice(CONTAINER_WORKSPACE.length + 1);
    }

    const safe = path.resolve(WORKSPACE_DIR, normalized);
    if (safe !== WORKSPACE_DIR && !safe.startsWith(WORKSPACE_DIR + path.sep)) {
        return { safe: '', error: 'Access denied: Path is outside of workspace' };
    }
    return { safe };
}
