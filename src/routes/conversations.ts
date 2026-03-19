import { Router } from 'express';
import { ConversationService, ConversationExecutor } from '../services/conversation-service.js';

const router = Router();

// List all conversations
router.get('/', (_req, res) => {
    try {
        res.json(ConversationService.list());
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Create a conversation
router.post('/', (req, res) => {
    try {
        const { title, format, topic, participants, orchestrator, settings } = req.body;
        if (!title || !format || !topic || !participants?.length) {
            return res.status(400).json({ error: 'title, format, topic, and participants are required' });
        }
        const config = ConversationService.create({
            title,
            format: format || 'freeform',
            topic,
            participants,
            orchestrator: orchestrator || {
                type: 'system',
                selectionStrategy: 'round-robin',
                closingStrategy: 'max-rounds'
            },
            settings: {
                maxRounds: 10,
                ...settings
            }
        });
        res.status(201).json(config);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Get conversation config + state
router.get('/:id', (req, res) => {
    try {
        const data = ConversationService.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Conversation not found' });
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get transcript entries (JSON)
router.get('/:id/transcript', (req, res) => {
    try {
        const data = ConversationService.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Conversation not found' });
        res.json(data.state.transcript);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get rendered transcript markdown
router.get('/:id/transcript.md', (req, res) => {
    try {
        const md = ConversationService.getTranscriptMarkdown(req.params.id);
        if (!md) return res.status(404).json({ error: 'Conversation not found' });
        res.type('text/markdown').send(md);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start or resume a conversation (fire-and-forget)
router.post('/:id/start', (req, res) => {
    try {
        const data = ConversationService.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Conversation not found' });

        if (ConversationExecutor.isRunning(req.params.id)) {
            return res.status(409).json({ error: 'Conversation is already running' });
        }
        if (data.state.status === 'complete') {
            return res.status(400).json({ error: 'Conversation is already complete' });
        }

        // Fire and forget
        ConversationExecutor.run(req.params.id).catch(() => {});
        res.json({ success: true, message: 'Conversation started' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Cancel a running conversation
router.post('/:id/cancel', (req, res) => {
    try {
        const cancelled = ConversationExecutor.cancel(req.params.id);
        if (!cancelled) {
            return res.status(404).json({ error: 'No running conversation found with this ID' });
        }
        res.json({ success: true, message: 'Conversation cancellation requested' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Restore a campaign from GitHub
router.post('/:id/restore', async (req, res) => {
    try {
        const { repo, branch } = req.body;
        if (!repo) {
            return res.status(400).json({ error: 'repo is required (e.g. "username/campaign-repo")' });
        }
        const result = await ConversationService.restore(
            { repo, branch: branch || 'main', saveEveryNRounds: 1 },
            req.params.id
        );
        if (!result) {
            return res.status(404).json({ error: 'Campaign not found in the specified GitHub repo' });
        }
        res.json({ success: true, config: result.config, state: { ...result.state, transcript: `${result.state.transcript.length} entries` } });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete a conversation
router.delete('/:id', (req, res) => {
    try {
        const deleted = ConversationService.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Conversation not found' });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
