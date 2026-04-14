/**
 * Command safety validation for the bash tool.
 * Detects destructive commands and returns warnings instead of executing them.
 */

export interface SafetyCheck {
    blocked: boolean;
    reason?: string;
    suggestion?: string;
}

const DESTRUCTIVE_GIT_PATTERNS: Array<{ pattern: RegExp; reason: string; suggestion: string }> = [
    {
        pattern: /\bgit\s+reset\s+--hard\b/,
        reason: 'git reset --hard discards all uncommitted changes permanently',
        suggestion: 'Use `git stash` to save changes, or `git reset --soft` to keep them staged'
    },
    {
        pattern: /\bgit\s+push\s+.*--force\b|\bgit\s+push\s+-f\b/,
        reason: 'git push --force can overwrite remote history and destroy other contributors\' work',
        suggestion: 'Use `git push --force-with-lease` for a safer alternative that checks for upstream changes'
    },
    {
        pattern: /\bgit\s+clean\s+.*-f/,
        reason: 'git clean -f permanently deletes untracked files',
        suggestion: 'Use `git clean -n` (dry run) first to see what would be deleted'
    },
    {
        pattern: /\bgit\s+checkout\s+\.\s*$/,
        reason: 'git checkout . discards all unstaged changes in the working tree',
        suggestion: 'Use `git stash` to save changes, or target specific files with `git checkout -- <file>`'
    },
    {
        pattern: /\bgit\s+branch\s+-D\b/,
        reason: 'git branch -D force-deletes a branch even if it has unmerged changes',
        suggestion: 'Use `git branch -d` (lowercase) which refuses to delete unmerged branches'
    },
    {
        pattern: /\bgit\s+restore\s+\.\s*$/,
        reason: 'git restore . discards all unstaged changes in the working tree',
        suggestion: 'Use `git stash` to save changes, or target specific files with `git restore <file>`'
    },
];

const DANGEROUS_RM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    {
        pattern: /\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/\s*$/,
        reason: 'rm -rf / would delete the entire filesystem'
    },
    {
        pattern: /\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+~\s*$/,
        reason: 'rm -rf ~ would delete the entire home directory'
    },
    {
        pattern: /\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/\w+\s*$/,
        reason: 'rm -rf on a top-level system directory is extremely dangerous'
    },
    {
        pattern: /\brm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\.\.\/?/,
        reason: 'rm -rf with parent directory traversal (..) could delete files outside the workspace'
    },
];

export function checkCommandSafety(command: string): SafetyCheck {
    const trimmed = command.trim();

    // Check for sudo usage
    if (/^\s*sudo\b/.test(trimmed)) {
        return {
            blocked: true,
            reason: 'Running commands with sudo is not allowed in the workspace environment',
            suggestion: 'Run the command without sudo, or ask the user to run it manually in their terminal'
        };
    }

    // Check destructive git commands
    for (const { pattern, reason, suggestion } of DESTRUCTIVE_GIT_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { blocked: true, reason, suggestion };
        }
    }

    // Check dangerous rm patterns
    for (const { pattern, reason } of DANGEROUS_RM_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                blocked: true,
                reason,
                suggestion: 'Use more targeted rm commands, or ask the user to confirm this operation'
            };
        }
    }

    // Check for commands that kill all processes
    if (/\bkillall\b/.test(trimmed) || /\bkill\s+-9\s+-1\b/.test(trimmed)) {
        return {
            blocked: true,
            reason: 'Mass process termination is not allowed',
            suggestion: 'Target specific processes by name or PID'
        };
    }

    return { blocked: false };
}
