**Filter CISA Reports:**
- When using the `cisa_reporter` tool's `parse_bulletin` action, you MUST first read the file `cisa/managed_services.json` from the workspace using the `file_manager` tool's `read` action.
- Extract the list of services from the `services` array in that JSON.
- Pass this array to the `services` parameter in `cisa_reporter`. 
- NEVER attempt to parse a full CISA bulletin without applying these filters, as the payload will be too large and will cause errors.