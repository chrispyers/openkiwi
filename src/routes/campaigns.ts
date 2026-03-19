import { Router } from 'express';
import { CampaignService } from '../services/campaign-service.js';

const router = Router();

// List campaigns
router.get('/', (_req, res) => {
    try {
        res.json(CampaignService.list());
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Create a campaign
router.post('/', (req, res) => {
    try {
        const config = CampaignService.create(req.body);
        res.status(201).json(config);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Get campaign config + state
router.get('/:id', (req, res) => {
    try {
        const data = CampaignService.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Campaign not found' });
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete campaign
router.delete('/:id', (req, res) => {
    try {
        const deleted = CampaignService.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── Characters ──

// List active characters
router.get('/:id/characters', (req, res) => {
    try {
        const data = CampaignService.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Campaign not found' });
        res.json(data.state.characters);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Add a character
router.post('/:id/characters', (req, res) => {
    try {
        const character = CampaignService.addCharacter(req.params.id, {
            ...req.body,
            introducedSeason: req.body.introducedSeason || 1,
            introducedEpisode: req.body.introducedEpisode || 1
        });
        res.status(201).json(character);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Kill a character
router.post('/:id/characters/:charId/kill', (req, res) => {
    try {
        const { episodeId, description } = req.body;
        if (!description) return res.status(400).json({ error: 'description is required' });
        const character = CampaignService.killCharacter(
            req.params.id, req.params.charId, episodeId || '', description
        );
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json(character);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Get a character's full sheet
router.get('/:id/characters/:charId', (req, res) => {
    try {
        const character = CampaignService.getCharacter(req.params.id, req.params.charId);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json(character);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update a character's sheet
router.patch('/:id/characters/:charId', (req, res) => {
    try {
        const character = CampaignService.updateCharacter(req.params.id, req.params.charId, req.body);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json(character);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Retire a character
router.post('/:id/characters/:charId/retire', (req, res) => {
    try {
        const character = CampaignService.retireCharacter(req.params.id, req.params.charId);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        res.json(character);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── Episodes ──

// Start next episode
router.post('/:id/episodes/next', async (req, res) => {
    try {
        const result = await CampaignService.startNextEpisode(req.params.id);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Complete an episode
router.post('/:id/episodes/:conversationId/complete', (req, res) => {
    try {
        const { synopsis } = req.body;
        CampaignService.completeEpisode(req.params.id, req.params.conversationId, synopsis);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── Seasons ──

// Advance to next season
router.post('/:id/seasons/advance', (req, res) => {
    try {
        const result = CampaignService.advanceSeason(req.params.id);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Update a season's arc
router.put('/:id/seasons/:season', (req, res) => {
    try {
        const { title, arc } = req.body;
        if (!title || !arc) return res.status(400).json({ error: 'title and arc are required' });
        CampaignService.updateSeasonArc(req.params.id, parseInt(req.params.season), title, arc);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
