import { EventEmitter } from 'node:events';
import { logger } from '../logger.js';

export interface ScratchpadEntry {
    agentId: string;
    label: string;
    timestamp: number;
    data: any;
    status: 'partial' | 'complete';
}

/**
 * In-memory scratchpad for inter-agent communication during multi-agent runs.
 *
 * Each run gets its own key. Agents write findings here and read each other's
 * work. An EventEmitter provides real-time notifications so agents (or the UI)
 * can react to new entries without polling.
 *
 * Designed to be swapped for Redis/pub-sub later if OpenKIWI goes multi-process.
 */
class ScratchpadService {
    private runs = new Map<string, ScratchpadEntry[]>();
    private emitter = new EventEmitter();
    /** Tracks active delegated agent promises keyed by runId → agentId */
    private activeRuns = new Map<string, Map<string, Promise<any>>>();

    // ── Read / Write ──────────────────────────────────────────────

    write(runId: string, entry: ScratchpadEntry): void {
        if (!this.runs.has(runId)) {
            this.runs.set(runId, []);
        }
        this.runs.get(runId)!.push(entry);
        this.emitter.emit(`entry:${runId}`, entry);

        logger.log({
            type: 'system',
            level: 'info',
            message: `[Scratchpad] ${entry.agentId} wrote "${entry.label}" (${entry.status}) to run ${runId}`,
        });
    }

    read(runId: string, filter?: { agentId?: string }): ScratchpadEntry[] {
        const entries = this.runs.get(runId) || [];
        if (filter?.agentId) {
            return entries.filter(e => e.agentId === filter.agentId);
        }
        return [...entries];
    }

    /**
     * Subscribe to new entries on a run. Returns an unsubscribe function.
     */
    subscribe(runId: string, callback: (entry: ScratchpadEntry) => void): () => void {
        const event = `entry:${runId}`;
        this.emitter.on(event, callback);
        return () => this.emitter.off(event, callback);
    }

    // ── Active Run Tracking ───────────────────────────────────────

    /**
     * Track a delegated agent's promise so `waitForAgents` can await it.
     */
    trackAgent(runId: string, agentId: string, promise: Promise<any>): void {
        if (!this.activeRuns.has(runId)) {
            this.activeRuns.set(runId, new Map());
        }
        this.activeRuns.get(runId)!.set(agentId, promise);
    }

    /**
     * Wait for all (or specific) delegated agents on a run to finish.
     * Returns a map of agentId → result.
     */
    async waitForAgents(
        runId: string,
        agentIds?: string[],
        timeoutMs: number = 300_000 // 5 minutes default
    ): Promise<Record<string, { success: boolean; result?: any; error?: string }>> {
        const agentMap = this.activeRuns.get(runId);
        if (!agentMap || agentMap.size === 0) {
            return {};
        }

        const targets = agentIds
            ? [...agentMap.entries()].filter(([id]) => agentIds.includes(id))
            : [...agentMap.entries()];

        const results: Record<string, { success: boolean; result?: any; error?: string }> = {};

        await Promise.all(
            targets.map(async ([agentId, promise]) => {
                try {
                    const result = await Promise.race([
                        promise,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error(`Agent "${agentId}" timed out after ${timeoutMs}ms`)), timeoutMs)
                        ),
                    ]);
                    results[agentId] = { success: true, result };
                } catch (err: any) {
                    results[agentId] = { success: false, error: err.message };
                } finally {
                    agentMap.delete(agentId);
                }
            })
        );

        // Clean up empty run maps
        if (agentMap.size === 0) {
            this.activeRuns.delete(runId);
        }

        return results;
    }

    // ── Cleanup ───────────────────────────────────────────────────

    clear(runId: string): void {
        this.runs.delete(runId);
        this.activeRuns.delete(runId);
        this.emitter.removeAllListeners(`entry:${runId}`);
    }

    /** List active run IDs (useful for debugging / UI). */
    listRuns(): string[] {
        return [...new Set([...this.runs.keys(), ...this.activeRuns.keys()])];
    }
}

/** Singleton — shared across the entire process. */
export const Scratchpad = new ScratchpadService();
