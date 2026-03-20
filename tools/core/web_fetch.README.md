# Web Fetch

Fetches the content of a webpage or URL and returns it as text. Use this tool to retrieve documentation, API responses, raw files from the internet, or any other web resource by its direct URL.

## Parameters

- `url` *(required)* — The full URL to fetch (e.g. `"https://api.github.com/repos/owner/repo"`).
- `screenshot` *(optional, default: `false`)* — When `true`, a screenshot of the rendered page is captured and a `screenshot_url` is included in the result.

## Examples

**Fetch page content only (default):**
```json
{
  "url": "https://raw.githubusercontent.com/nicedoc/project/main/README.md"
}
```

**Fetch page content and capture a screenshot:**
```json
{
  "url": "https://example.com",
  "screenshot": true
}
```

## Notes

- Returns the page content as text. HTML pages are returned as-is; use your judgment to extract the relevant parts.
- Screenshots are only captured when `screenshot: true` is explicitly set. The result will include a `screenshot_url` field pointing to the saved image.
- For discovering content without a known URL, use **Web Search** instead.
- This tool requires approval before execution.
