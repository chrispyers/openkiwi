import { Router } from 'express';
import { SessionManager } from '../session-manager.js';
import { signMarkdown } from '../security.js';

const router = Router();

router.get('/', (req, res) => {
    const sessions = SessionManager.listSessions().map(session => ({
        ...session,
        messages: session.messages.map(m => ({
            ...m,
            content: signMarkdown(m.content)
        }))
    }));
    res.json(sessions);
});

router.get('/:id', (req, res) => {
    const session = SessionManager.getSession(req.params.id);
    if (session) {
        const signedSession = {
            ...session,
            messages: session.messages.map(m => ({
                ...m,
                content: signMarkdown(m.content)
            }))
        };
        res.json(signedSession);
    }
    else res.status(404).json({ error: 'Session not found' });
});

router.delete('/:id', (req, res) => {
    SessionManager.deleteSession(req.params.id);
    res.json({ success: true });
});

export default router;
