# Report Writer

Reads files matching a glob pattern from the workspace, synthesizes their content into a report using the configured AI model, and saves the result to a specified output path.

Use this as the final step in a workflow to aggregate outputs — scan results, logs, data exports — into a single coherent document without any manual intervention.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `glob_pattern` | Yes | Glob pattern for input files, relative to the workspace root. All matching files are read and passed to the model together. |
| `prompt` | Yes | Instructions describing what report to generate. Be specific about format, structure, and what to highlight. |
| `output_path` | Yes | Output file path relative to the workspace root. The directory is created automatically if it does not exist. |

## Examples

### Security executive summary

After running a multi-repo security scan workflow, aggregate all `scan-results.md` files into a single executive summary:

```json
{
  "glob_pattern": "security/**/scan-results.md",
  "prompt": "Create a high-level executive summary of all security findings across these repositories. Include: (1) a table showing each repo with finding counts by severity, (2) a prioritised list of the most critical issues with suggested fixes, (3) recommended next steps. Format in clear Markdown suitable for a non-technical stakeholder.",
  "output_path": "security/executive_summary.md"
}
```

### Dependency vulnerability digest

```json
{
  "glob_pattern": "scans/**/scan-results.json",
  "prompt": "Summarise all dependency vulnerabilities found. Group by severity (Critical, High, Medium, Low). For each Critical or High finding, list the affected package, the CVE, and the recommended remediation.",
  "output_path": "scans/vulnerability_digest.md"
}
```

### Log analysis report

```json
{
  "glob_pattern": "logs/**/*.txt",
  "prompt": "Analyse these log files and produce a concise operations report. Highlight any errors, warnings, or anomalies. Include a timeline of significant events and any patterns that suggest a systemic issue.",
  "output_path": "reports/log_analysis.md"
}
```

## Notes

- Files are read in alphabetical order and passed to the model as a single combined document. For very large file sets the combined content may exceed the model's context window — scope your glob pattern to the relevant subset.
- The output is always Markdown. The model is instructed to use tables where they aid readability.
- The tool uses the first configured LLM provider. No separate API key or configuration is needed beyond what is already set up in Settings.
- All paths are sandboxed to the workspace — glob patterns and output paths that would escape the workspace root are rejected.
