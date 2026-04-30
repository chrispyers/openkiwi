import { Router } from 'express';
import { MCPClientManager } from '../mcp-client.js';

const router = Router();

// GET /api/mcp/status — Get status of all MCP server connections
router.get('/status', (req, res) => {
    res.json(MCPClientManager.getStatus());
});

// POST /api/mcp/reconnect — Reconnect all MCP servers (re-reads config)
router.post('/reconnect', async (req, res) => {
    try {
        await MCPClientManager.connectAll();
        res.json({ success: true, servers: MCPClientManager.getStatus() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
