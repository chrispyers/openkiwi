# Security Scanner

Run a Docker-based security scanner against a path in the workspace. The tool produces two output files: a raw JSON file for programmatic use, and a human-readable Markdown report with a summary and per-finding details.

**Requires Docker.** No host-side installation of any scanner is needed — each tool runs in its own disposable container.

## Supported Scanners

| Scanner | Best For | Docker Image |
|---------|----------|--------------|
| `semgrep` (default) | Multi-language static analysis (SAST) | `semgrep/semgrep` |
| `gitleaks` | Detecting hardcoded secrets and credentials | `zricethezav/gitleaks` |
| `bandit` | Python-specific security issues | `ghcr.io/pycqa/bandit/bandit` |
| `trivy` | Dependency and container vulnerabilities | `aquasec/trivy` |

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `path` | Yes | Path to scan, relative to the workspace (e.g. `my-repo` or `my-repo/src`) |
| `scanner` | No | Which scanner to use. Default: `semgrep` |
| `config` | No | Scanner-specific ruleset (Semgrep only). Default: `auto` |
| `output_file` | No | Base filename for output files (no extension). Default: `scan-results` |
| `timeout` | No | Max scan time in seconds. Default: `300` (5 minutes) |

## Semgrep Rulesets (`config`)

| Config | Description |
|--------|-------------|
| `auto` | Semgrep detects languages and selects rules automatically |
| `p/owasp-top-ten` | OWASP Top 10 vulnerabilities |
| `p/javascript` | JavaScript / Node.js specific rules |
| `p/python` | Python specific rules |
| `p/secrets` | Secret and credential detection |
| `p/java` | Java specific rules |
| `p/golang` | Go specific rules |

Full list: [semgrep.dev/r](https://semgrep.dev/r)

## Output

The tool writes two files to the workspace root:

- **`{output_file}.json`** — Raw scanner output. Format varies by scanner.
- **`{output_file}.md`** — Human-readable Markdown report with a summary table and per-finding details sorted by severity.

The tool call response also includes a `topFindings` array (up to 10) so the agent can summarise results immediately without reading the output file.

### Example Markdown Report

```markdown
# Security Scan Report

| | |
|---|---|
| **Scanner** | semgrep |
| **Target** | `my-repo` |
| **Config / Ruleset** | auto |
| **Date** | 2026-03-11 14:32:01 UTC |
| **Total Findings** | 3 |

## Severity Breakdown

| Severity | Count |
|----------|-------|
| High | 1 |
| Medium | 2 |

## Findings

### my-repo/src/auth.js:42
- **Severity:** HIGH
- **Rule:** `javascript.jose.security.jwt-hardcoded-secret`
- **Message:** JWT secret is hardcoded. Use an environment variable instead.
```

## Typical Workflow

1. Use the **Clone Repository** tool to clone a git repo into the workspace
2. Use the **Security Scanner** tool with the `clonedTo` path from step 1
3. Read the generated `.md` report or have the agent summarise the `topFindings`

## Notes

- On first use, Docker will pull the scanner image. This can take 1–2 minutes depending on network speed. Subsequent runs use the cached image and are fast.
- Scan targets are always mounted **read-only** inside the container. The scanner cannot modify your code.
- The scan target must be inside the workspace. Paths outside the workspace are rejected.

## Planned Enhancements

- **User-specified Semgrep ruleset in the UI**: Allow the workflow node form to expose a dropdown of common rulesets (`auto`, `p/owasp-top-ten`, etc.) so users don't need to know the config strings.
- **Private registry support**: Pull scanner images from a private Docker registry.
- **Additional scanners**: [Snyk](https://snyk.io/), [Bearer](https://github.com/Bearer/bearer), [Checkov](https://www.checkov.io/) (IaC).
- **SARIF output**: Export results in SARIF format for integration with GitHub Code Scanning and other CI/CD platforms.
- **Differential scanning**: Compare findings against a baseline to surface only new issues introduced since the last scan.
- **GitHub PAT integration**: When the GitHub connection is configured in Settings, automatically use the token to clone private repos before scanning.
