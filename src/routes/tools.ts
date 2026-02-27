import { Router } from 'express';
import { ToolManager } from '../tool-manager.js';

const router = Router();

router.get('/', (req, res) => {
    const definitions = ToolManager.getToolDefinitions();
    const availableFiles = ToolManager.getAvailableToolFiles();
    res.json({ definitions, availableFiles });
});

export default router;
