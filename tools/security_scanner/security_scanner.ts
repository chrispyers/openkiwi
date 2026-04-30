import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';

const execAsync = promisify(exec);
const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

// ── Types ──────────────────────────────────────────────────────────────────────

type ScannerName = 'semgrep' | 'gitleaks' | 'bandit' | 'trivy';

interface Finding {
    file: string;
    line: number;
    severity: string;
    rule: string;
    message: string;
}

interface ParsedResults {
    findings: Finding[];
    rawJson: unknown;
}

// ── Severity sort ──────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
    critical: 0, high: 1, error: 1,
    medium: 2, warning: 2,
    low: 3, info: 4, note: 4, unknown: 5
};

function sortFindings(findings: Finding[]): Finding[] {
    return findings.sort((a, b) => {
        const ra = SEVERITY_RANK[a.severity.toLowerCase()] ?? 5;
        const rb = SEVERITY_RANK[b.severity.toLowerCase()] ?? 5;
        if (ra !== rb) return ra - rb;
        return a.file.localeCompare(b.file) || a.line - b.line;
    });
}

// ── Per-scanner output parsers ─────────────────────────────────────────────────

function parseSemgrep(stdout: string): ParsedResults {
    const raw = JSON.parse(stdout);
    const findings: Finding[] = (raw.results ?? []).map((r: any) => ({
        file: r.path ?? 'unknown',
        line: r.start?.line ?? 0,
        severity: r.extra?.severity ?? 'unknown',
        rule: r.check_id ?? 'unknown',
        message: r.extra?.message ?? ''
    }));
    return { findings: sortFindings(findings), rawJson: raw };
}

function parseGitleaks(stdout: string): ParsedResults {
    // gitleaks outputs a JSON array, or nothing if clean
    const raw = stdout.trim() ? JSON.parse(stdout) : [];
    const arr = Array.isArray(raw) ? raw : [];
    const findings: Finding[] = arr.map((r: any) => ({
        file: r.File ?? r.file ?? 'unknown',
        line: r.StartLine ?? r.startLine ?? 0,
        severity: 'HIGH', // gitleaks has no severity levels; all secrets are critical
        rule: r.RuleID ?? r.ruleID ?? 'unknown',
        message: r.Description ?? r.description ?? r.Match ?? ''
    }));
    return { findings: sortFindings(findings), rawJson: raw };
}

function parseBandit(stdout: string): ParsedResults {
    const raw = JSON.parse(stdout);
    const findings: Finding[] = (raw.results ?? []).map((r: any) => ({
        file: r.filename ?? 'unknown',
        line: r.line_number ?? 0,
        severity: r.issue_severity ?? 'unknown',
        rule: r.test_id ?? 'unknown',
        message: `${r.test_name ?? ''}: ${r.issue_text ?? ''}`
    }));
    return { findings: sortFindings(findings), rawJson: raw };
}

function parseTrivy(stdout: string): ParsedResults {
    const raw = JSON.parse(stdout);
    const findings: Finding[] = [];
    for (const result of raw.Results ?? []) {
        for (const vuln of result.Vulnerabilities ?? []) {
            findings.push({
                file: result.Target ?? 'unknown',
                line: 0,
                severity: vuln.Severity ?? 'unknown',
                rule: vuln.VulnerabilityID ?? 'unknown',
                message: `${vuln.PkgName ?? ''}: ${vuln.Title ?? vuln.Description ?? ''}`
            });
        }
    }
    return { findings: sortFindings(findings), rawJson: raw };
}

// ── Scanner presets ────────────────────────────────────────────────────────────

interface ScannerPreset {
    image: string;
    buildCommand: (mountPath: string, config: string) => string;
    parseOutput: (stdout: string) => ParsedResults;
    /** Some scanners exit with code 1 when findings exist — treat stdout as valid output anyway */
    allowNonZeroExit?: boolean;
}

const PRESETS: Record<ScannerName, ScannerPreset> = {
    semgrep: {
        image: 'semgrep/semgrep',
        buildCommand: (mp, config) =>
            `docker run --rm -v "${mp}:/src:ro" semgrep/semgrep semgrep scan /src --config=${config} --json --no-rewrite-rule-ids`,
        parseOutput: parseSemgrep,
        allowNonZeroExit: true
    },
    gitleaks: {
        image: 'zricethezav/gitleaks',
        buildCommand: (mp, _) =>
            `docker run --rm -v "${mp}:/src:ro" zricethezav/gitleaks detect --source /src --report-format json --report-path - --no-git`,
        parseOutput: parseGitleaks,
        allowNonZeroExit: true // exits 1 when leaks are found
    },
    bandit: {
        image: 'ghcr.io/pycqa/bandit/bandit',
        buildCommand: (mp, _) =>
            `docker run --rm -v "${mp}:/src:ro" ghcr.io/pycqa/bandit/bandit bandit -r /src -f json -q`,
        parseOutput: parseBandit,
        allowNonZeroExit: true
    },
    trivy: {
        image: 'aquasec/trivy',
        buildCommand: (mp, _) =>
            `docker run --rm -v "${mp}:/src:ro" aquasec/trivy fs --format json --quiet /src`,
        parseOutput: parseTrivy
    }
};

// ── Markdown report generator ──────────────────────────────────────────────────

function buildMarkdownReport(
    scanner: ScannerName,
    scanPath: string,
    config: string,
    parsed: ParsedResults
): string {
    const { findings } = parsed;
    const date = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const counts: Record<string, number> = {};
    for (const f of findings) {
        const s = f.severity.toLowerCase();
        counts[s] = (counts[s] ?? 0) + 1;
    }

    const lines: string[] = [
        `# Security Scan Report`,
        ``,
        `| | |`,
        `|---|---|`,
        `| **Scanner** | ${scanner} |`,
        `| **Target** | \`${scanPath}\` |`,
        `| **Config / Ruleset** | ${config} |`,
        `| **Date** | ${date} |`,
        `| **Total Findings** | ${findings.length} |`,
        ``
    ];

    // Severity summary table
    const severityOrder = ['critical', 'high', 'error', 'medium', 'warning', 'low', 'info', 'note'];
    const presentSeverities = severityOrder.filter(s => counts[s]);
    if (presentSeverities.length > 0) {
        lines.push(`## Severity Breakdown`, ``);
        lines.push(`| Severity | Count |`);
        lines.push(`|----------|-------|`);
        for (const s of presentSeverities) {
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            lines.push(`| ${label} | ${counts[s]} |`);
        }
        lines.push(``);
    }

    if (findings.length === 0) {
        lines.push(`## Findings`, ``, `_No findings detected. Clean scan._`);
        return lines.join('\n');
    }

    lines.push(`## Findings`, ``);

    for (const f of findings) {
        const sevLabel = f.severity.toUpperCase();
        const location = f.line > 0 ? `:${f.line}` : '';
        lines.push(`### ${f.file}${location}`);
        lines.push(`- **Severity:** ${sevLabel}`);
        lines.push(`- **Rule:** \`${f.rule}\``);
        lines.push(`- **Message:** ${f.message}`);
        lines.push(``);
    }

    return lines.join('\n');
}

// ── Tool export ────────────────────────────────────────────────────────────────

export default {
    definition: {
        name: 'security_scanner',
        displayName: 'Security Scanner',
        description:
            'Run a Docker-based security scanner against a path in the workspace. ' +
            'Supports Semgrep (multi-language SAST), Gitleaks (secret detection), ' +
            'Bandit (Python), and Trivy (dependency vulnerabilities). ' +
            'Outputs both a raw JSON file and a human-readable Markdown report.',
        /** Deduplicate retries by scanner + scan target. */
        resultKey(args: { path: string; scanner?: string; output_dir?: string }): string | null {
            const scanner = args?.scanner || 'semgrep';
            const target = args?.path || '';
            return `${scanner}:${target}`;
        },
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description:
                        'Path to scan, relative to the workspace (e.g. "my-repo" or "my-repo/src"). ' +
                        'Use the git tool first to clone a repository (e.g. args: "clone https://github.com/owner/repo --depth 1").'
                },
                scanner: {
                    type: 'string',
                    enum: ['semgrep', 'gitleaks', 'bandit', 'trivy'],
                    description:
                        'Which scanner to run. Default: semgrep. ' +
                        'semgrep — multi-language static analysis (SAST). ' +
                        'gitleaks — detect hardcoded secrets and credentials. ' +
                        'bandit — Python-specific security issues. ' +
                        'trivy — dependency and container vulnerability scanning.'
                },
                config: {
                    type: 'string',
                    description:
                        'Scanner-specific ruleset or config string. ' +
                        'For Semgrep: "auto" (default), "p/owasp-top-ten", "p/javascript", "p/python", "p/secrets", etc. ' +
                        'Ignored by gitleaks, bandit, and trivy.'
                },
                output_dir: {
                    type: 'string',
                    description:
                        'Directory (relative to workspace root) where output files will be written. ' +
                        'The tool always writes scan-results.json and scan-results.md inside this directory. ' +
                        'The directory is created automatically if it does not exist. ' +
                        'Example: "security/adaptors/semgrep" → writes to workspace/security/adaptors/semgrep/scan-results.json and .md. ' +
                        'Default: workspace root.'
                },
                timeout: {
                    type: 'number',
                    description:
                        'Maximum scan duration in seconds. Default: 300 (5 minutes). ' +
                        'Increase for large repositories.'
                }
            },
            required: ['path']
        }
    },

    handler: async (args: {
        path: string;
        scanner?: ScannerName;
        config?: string;
        output_dir?: string;
        /** @deprecated use output_dir instead */
        output_file?: string;
        timeout?: number;
    }) => {
        const scanner: ScannerName = args.scanner ?? 'semgrep';
        const config = args.config ?? 'auto';
        const timeoutMs = (args.timeout ?? 300) * 1000;

        // Resolve output directory — support legacy output_file by treating it as output_dir if it
        // looks like a path (contains '/') or using it as a filename base for backward compatibility.
        let outputDir: string;
        if (args.output_dir) {
            outputDir = args.output_dir;
        } else if (args.output_file) {
            // Legacy: if output_file contains a slash we treat the last segment as the dir leaf,
            // otherwise fall back to placing files at workspace root with that base name.
            outputDir = args.output_file.includes('/') ? args.output_file : '';
        } else {
            outputDir = '';
        }

        // Validate scanner name
        const preset = PRESETS[scanner];
        if (!preset) {
            return {
                error: `Unknown scanner: "${scanner}". Valid options: ${Object.keys(PRESETS).join(', ')}`
            };
        }

        // Validate scan path is inside workspace
        const scanTarget = path.resolve(WORKSPACE_DIR, args.path);
        if (!scanTarget.startsWith(WORKSPACE_DIR + path.sep) && scanTarget !== WORKSPACE_DIR) {
            return { error: 'Access denied: scan path is outside the workspace.' };
        }
        if (!fs.existsSync(scanTarget)) {
            return {
                error: `Scan target not found: workspace/${args.path}. ` +
                    'Use the git tool to clone a repository first (e.g. args: "clone https://github.com/owner/repo").'
            };
        }

        // Validate output paths are inside workspace
        const outDirResolved = outputDir
            ? path.resolve(WORKSPACE_DIR, outputDir)
            : WORKSPACE_DIR;
        const jsonOut = path.join(outDirResolved, 'scan-results.json');
        const mdOut = path.join(outDirResolved, 'scan-results.md');
        if (!outDirResolved.startsWith(WORKSPACE_DIR)) {
            return { error: 'Access denied: output_dir is outside the workspace.' };
        }

        // Check Docker is available
        try {
            await execAsync('docker info --format "{{.ServerVersion}}"', { timeout: 8_000 });
        } catch {
            return {
                error:
                    'Docker is not running or not installed. ' +
                    'The security scanner requires Docker. Please start Docker and try again.'
            };
        }

        // Docker-out-of-Docker: when the gateway runs inside a container, the host
        // Docker daemon needs host-side paths for volume mounts, not container paths.
        // DOCKER_HOST_WORKSPACE maps /app/workspace → the host's workspace directory.
        const hostWorkspace = process.env.DOCKER_HOST_WORKSPACE;
        const mountPath = hostWorkspace
            ? scanTarget.replace(WORKSPACE_DIR, hostWorkspace)
            : scanTarget;

        const command = preset.buildCommand(mountPath, config);
        console.log(`[security_scanner] ${command}`);

        let stdout = '';
        let stderr = '';
        try {
            const result = await execAsync(command, {
                timeout: timeoutMs,
                maxBuffer: 100 * 1024 * 1024 // 100MB — large repos can produce large output
            });
            stdout = result.stdout;
            stderr = result.stderr;
        } catch (e: any) {
            if (preset.allowNonZeroExit && e.stdout) {
                // Scanner found issues and exited non-zero — stdout still contains valid JSON
                stdout = e.stdout;
                stderr = e.stderr ?? '';
            } else {
                const detail = e.stderr?.trim() ?? e.message;
                // Provide a helpful hint if the image needs pulling
                const hint = detail.includes('Unable to find image')
                    ? ' (Docker is pulling the image on first use — this may take a minute)'
                    : '';
                return { error: `Scanner failed: ${detail}${hint}` };
            }
        }

        // Parse scanner output
        let parsed: ParsedResults;
        try {
            parsed = preset.parseOutput(stdout);
        } catch (e: any) {
            return {
                error: `Failed to parse scanner output: ${e.message}`,
                rawOutputPreview: stdout.slice(0, 2000)
            };
        }

        // Count findings by severity
        const bySeverity: Record<string, number> = {};
        for (const f of parsed.findings) {
            const s = f.severity.toLowerCase();
            bySeverity[s] = (bySeverity[s] ?? 0) + 1;
        }

        // Write output files (create directory first if needed)
        fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
        fs.writeFileSync(jsonOut, JSON.stringify(parsed.rawJson, null, 2), 'utf-8');
        fs.writeFileSync(mdOut, buildMarkdownReport(scanner, args.path, config, parsed), 'utf-8');

        return {
            success: true,
            scanner,
            scanPath: args.path,
            config,
            totalFindings: parsed.findings.length,
            bySeverity,
            outputJson: jsonOut,
            outputMarkdown: mdOut,
            // Return the top findings inline so the agent can summarise without reading the file
            topFindings: parsed.findings.slice(0, 10).map(f => ({
                file: f.file,
                line: f.line,
                severity: f.severity,
                rule: f.rule,
                message: f.message.slice(0, 300)
            })),
            note: stderr.trim() ? `Scanner stderr: ${stderr.slice(0, 500)}` : undefined
        };
    }
};
