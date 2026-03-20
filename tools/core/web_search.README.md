# Web Search

Performs a web search and returns a list of results. Use this tool to find information, documentation, news, or resources when you don't have a direct URL.

Optionally restrict the search to a specific domain to get more focused results.

## Parameters

- `query` — The search query (e.g. `"React useEffect cleanup function"`).
- `domainFilter` *(optional)* — A domain to restrict results to (e.g. `"docs.python.org"`, `"github.com"`).

## Examples

General search:
```json
{
  "query": "how to debounce a function in JavaScript"
}
```

Search restricted to a domain:
```json
{
  "query": "pagination",
  "domainFilter": "docs.djangoproject.com"
}
```

## Notes

- When you have a direct URL, use **Web Fetch** instead for faster, more precise retrieval.
- This tool requires approval before execution.
