import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AgentManager } from '../agent-manager.js';
import { broadcastMessage } from '../state.js';
import { logger } from '../logger.js';
import {
    ConversationService,
    ConversationExecutor,
    CampaignPersistence,
    type ConversationConfig,
    type ConversationState,
    type ParticipantConfig,
    type OrchestratorConfig,
    type ConversationSettings
} from './conversation-service.js';

// ── Campaign Data Model ─────────────────────────────────────────────────────

export interface CampaignConfig {
    id: string;
    title: string;                         // "The Shattered Realms"
    setting: string;                       // World description / genre / tone
    rules: string;                         // Game system rules for the orchestrator
    orchestratorAgentId: string;           // GM agent
    maxPcsAtOnce: number;                  // e.g. 6
    seasonsPlanned: number;                // e.g. 5-6
    episodesPerSeason: number;             // e.g. 12
    roundsPerEpisode: number;             // rounds per episode (~30 min podcast)
    providers?: string[];                  // LLM providers to rotate across agents for neuro-diversity
    persistence?: CampaignPersistence;
    settings?: Partial<ConversationSettings>;  // Defaults for episodes
    schedule?: string;                        // Cron expression for auto-triggering episodes (e.g. "0 10 * * *" for daily at 10am)
    createdAt: number;
    updatedAt: number;
}

export interface Character {
    id: string;
    name: string;
    agentId: string;                       // Which agent plays this character
    class?: string;                        // "Fighter", "Mage", etc.
    race?: string;                         // "Human", "Elf", etc.
    level?: number;
    xp?: number;                           // Experience points
    stats?: Record<string, number>;        // { STR: 16, AGI: 12, ... }
    background?: string;                   // Character backstory
    traits?: string[];                     // Personality traits
    abilities?: string[];                  // Class abilities, feats, special skills
    spells?: string[];                     // Known spells (for magic users)
    inventory?: string[];                  // Carried items
    equipped?: {                           // Currently equipped gear
        weapon?: string;
        armour?: string;
        shield?: string;
        accessories?: string[];
    };
    conditions?: string[];                 // Active conditions: "poisoned", "exhausted", "wounded (left arm)", "warp sickness"
    wounds?: number;                       // Wound count (0-3, mortal danger at 3)
    warpExposure?: number;                 // Cumulative Warp exposure (0-10). 3+ = mild symptoms, 6+ = mutations risk, 9+ = critical
    notes?: string[];                      // GM/player notes that persist across episodes
    relationships?: Record<string, string>; // { "Kael Ashborne": "trusts grudgingly", "Fennick": "suspects of treachery" }
    status: 'active' | 'dead' | 'retired' | 'missing';
    deathEpisode?: string;                 // Episode ID where they died
    deathDescription?: string;
    introducedSeason: number;
    introducedEpisode: number;
    createdAt: number;
}

export interface SeasonArc {
    season: number;
    title: string;                         // "Season 1: The Gathering Storm"
    arc: string;                           // Season-level story arc
    status: 'planned' | 'active' | 'complete';
    episodes: EpisodeRef[];
}

export interface EpisodeRef {
    episode: number;
    conversationId: string;               // Links to a conversation
    title: string;
    synopsis?: string;                     // Post-episode summary
    status: 'planned' | 'active' | 'complete';
}

export interface CampaignState {
    id: string;
    currentSeason: number;
    currentEpisode: number;
    characters: Character[];
    seasons: SeasonArc[];
    worldState: Record<string, any>;       // Persistent world state across episodes
    majorArc: string;                      // The overarching 5-6 season arc
    previouslyOn: string[];                // Rolling summary of recent events for context
    createdAt: number;
    updatedAt: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const CAMPAIGNS_DIR = path.resolve(process.cwd(), 'workspace', 'campaigns');

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function campaignConfigPath(id: string) { return path.join(CAMPAIGNS_DIR, id, 'campaign.json'); }
function campaignStatePath(id: string) { return path.join(CAMPAIGNS_DIR, id, 'state.json'); }

function readJSON<T>(filePath: string): T | null {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
}

function writeJSON(filePath: string, data: any) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── CampaignService ─────────────────────────────────────────────────────────

// ── Agent Auto-Creation ─────────────────────────────────────────────────────

const AGENTS_DIR = path.resolve(process.cwd(), 'agents');

function createCampaignAgent(
    campaignId: string,
    name: string,
    persona: string,
    provider?: string
): string {
    const suffix = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const agentId = `campaign-${suffix}`;
    const agentDir = path.join(AGENTS_DIR, agentId);

    // If agent already exists, just return the ID
    if (fs.existsSync(agentDir)) {
        // Update persona in case it changed
        fs.writeFileSync(path.join(agentDir, 'PERSONA.md'), persona, 'utf-8');
        return agentId;
    }

    fs.mkdirSync(agentDir, { recursive: true });

    // Write persona
    fs.writeFileSync(path.join(agentDir, 'PERSONA.md'), persona, 'utf-8');

    // Write rules — minimal, focused on roleplay
    fs.writeFileSync(path.join(agentDir, 'RULES.md'), [
        '# Rules',
        '',
        '- You are a character in an ongoing RPG campaign.',
        '- Stay in character at all times.',
        '- Respond with dialogue, actions, and inner thoughts as your character.',
        '- React to the world and other characters naturally.',
        '- Do not break the fourth wall or reference game mechanics directly.',
        '- Keep responses vivid but concise (2-4 paragraphs).',
    ].join('\n'), 'utf-8');

    // Write empty memory
    fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), '', 'utf-8');

    // Write config
    const config: Record<string, any> = { name, campaignId };
    if (provider) config.provider = provider;
    fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

    logger.log({ type: 'system', level: 'info', message: `Created campaign agent: ${agentId} (${name})`, data: { campaignId } });
    return agentId;
}

function buildCharacterPersona(char: {
    name: string;
    race?: string;
    class?: string;
    background?: string;
    traits?: string[];
}, setting: string): string {
    let persona = `# ${char.name}\n\n`;
    persona += `You are **${char.name}**`;
    if (char.race) persona += `, a ${char.race}`;
    if (char.class) persona += ` ${char.class}`;
    persona += '.\n\n';

    if (char.background) {
        persona += `## Background\n${char.background}\n\n`;
    }

    if (char.traits && char.traits.length > 0) {
        persona += `## Personality\n`;
        for (const t of char.traits) {
            persona += `- ${t}\n`;
        }
        persona += '\n';
    }

    persona += `## Setting\n${setting}\n\n`;
    persona += `## How to Play\n`;
    persona += `Speak and act as ${char.name} would. Use first person. `;
    persona += `Describe your actions, dialogue, and reactions in vivid prose. `;
    persona += `You live in this world — it is real to you. `;
    persona += `React emotionally to danger, loss, and triumph. `;
    persona += `You do not know you are in a game.\n`;

    return persona;
}

function buildOrchestratorPersona(campaignTitle: string, setting: string): string {
    return `# Game Master — ${campaignTitle}

You are the Game Master (GM) for an ongoing RPG campaign set in a grimdark fantasy world.

## Setting
${setting}

## Your Role
- You are the narrator, the world, and every NPC.
- You control the pacing, tone, and dramatic tension of each episode.
- You decide what happens in the world based on character actions and dice rolls.
- You are fair but unforgiving — this is a dangerous world and consequences are real.
- Characters can and should die when the story demands it.
- You create memorable, cinematic moments suitable for a podcast audience.

## Magic System (Vancian)
- Magic is rare, powerful, and dangerous. True mages are vanishingly uncommon.
- Spells must be memorised from written sources — casting erases them from the mind.
- No starting character is a mage. Magical ability is earned through story progression.
- Relic-bound magic (items with stored spells) is the most common way people encounter magic.
- When a character attempts magic: WIL check DC 15+. Failure = spell lost AND backlash. Nat 1 = catastrophic.
- Treat magic as awe-inspiring and fearsome, never routine.

## The Warp (Magical Contamination)
- Residual magical energy zones left by the Sundering, like radiation after a nuclear blast.
- Four severity levels: Faint, Moderate, Severe, Critical (Warp Storms).
- Characters in Warp zones make WIL saves — failure causes sickness, mutations, or worse.
- The Warp is spreading into previously clean areas — this is a key mystery.
- Warp-stones (small Relics) darken to warn of intensity.
- Magic cast in Warp zones is amplified but wildly unstable.

## Coolness Under Fire (CUF)
- Separate stat (1-10). Determines composure under sudden danger.
- When combat starts or a sudden threat appears: d20 vs DC (20 - CUF). Failure = hesitate/act last/freeze for a round. Nat 1 = full panic.
- Also applies when: acting while wounded (DC penalty = wound count), resisting Warp fear in Severe+ zones, keeping composure under interrogation.
- CUF improves only through surviving dangerous situations — it cannot be trained.
- Low CUF is not cowardice, it's inexperience. High CUF means they've seen too much.

## Style
- Vivid, atmospheric prose for narration and scene-setting.
- Distinct voices for NPCs.
- Balance between action, dialogue, mystery, and quiet character moments.
- Grimdark tone: hope exists, but it's hard-won and fragile.
- Cliffhangers at episode endings when appropriate.

## Content Rating: PG-13/15
- Violence can be dramatic and consequential but not gratuitously gory or torture-focused.
- Death happens — it's meaningful and emotional, not shock-value splatter.
- No explicit sexual content. Romance and relationships are fine but kept tasteful.
- Language can be strong but not excessive — characters can swear but it shouldn't dominate.
- Horror elements lean on atmosphere, dread, and the unknown rather than body horror.
- Themes can be mature (loss, betrayal, moral complexity) while remaining accessible to younger audiences.
`;
}

// ── XP & Levelling ──────────────────────────────────────────────────────────

/**
 * XP required to reach a given level. Progressively harder.
 * Level 1→2: 10 XP, Level 2→3: 15, Level 3→4: 25, Level 4→5: 40, etc.
 * Formula: sum of (5 + level * 5) for each level crossed.
 * Cumulative thresholds: 0, 10, 25, 50, 90, 145, 220, 320, 450, 615...
 */
function xpForLevel(level: number): number {
    let total = 0;
    for (let l = 1; l < level; l++) {
        total += 5 + l * 5;
    }
    return total;
}

function xpToNextLevel(currentLevel: number): number {
    return xpForLevel(currentLevel + 1);
}

/**
 * Check if a character should level up based on current XP, and apply it.
 * Returns the new level if levelled up, or the current level if not.
 */
function checkLevelUp(character: Character): { levelled: boolean; newLevel: number } {
    const xp = character.xp || 0;
    const currentLevel = character.level || 1;
    let newLevel = currentLevel;

    // Allow multiple level-ups if XP is high enough
    while (xp >= xpForLevel(newLevel + 1)) {
        newLevel++;
    }

    if (newLevel > currentLevel) {
        character.level = newLevel;
        return { levelled: true, newLevel };
    }
    return { levelled: false, newLevel: currentLevel };
}

export class CampaignService {
    static list(): CampaignConfig[] {
        ensureDir(CAMPAIGNS_DIR);
        const dirs = fs.readdirSync(CAMPAIGNS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory());
        const configs: CampaignConfig[] = [];
        for (const d of dirs) {
            const cfg = readJSON<CampaignConfig>(campaignConfigPath(d.name));
            if (cfg) configs.push(cfg);
        }
        return configs.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    static get(id: string): { config: CampaignConfig; state: CampaignState } | null {
        const config = readJSON<CampaignConfig>(campaignConfigPath(id));
        if (!config) return null;
        const state = readJSON<CampaignState>(campaignStatePath(id));
        if (!state) return null;
        return { config, state };
    }

    static create(input: {
        title: string;
        setting: string;
        rules: string;
        orchestratorAgentId?: string;        // If omitted, auto-creates a GM agent
        majorArc: string;
        maxPcsAtOnce?: number;
        seasonsPlanned?: number;
        episodesPerSeason?: number;
        roundsPerEpisode?: number;
        persistence?: CampaignPersistence;
        settings?: Partial<ConversationSettings>;
        provider?: string;                   // Default LLM provider for auto-created agents
        providers?: string[];                // Multiple providers to rotate for neuro-diversity
        initialWorldState?: Record<string, any>;
        characters?: Array<{
            name: string;
            agentId?: string;                // If omitted, auto-creates an agent
            provider?: string;               // Override provider for this character
            class?: string;
            race?: string;
            level?: number;
            stats?: Record<string, number>;
            background?: string;
            traits?: string[];
            inventory?: string[];
        }>;
        schedule?: string;                   // Cron expression for auto-episodes (e.g. "0 10 * * *")
        seasons?: Array<{ title: string; arc: string }>;
    }): CampaignConfig {
        const id = randomUUID();
        const now = Date.now();

        // Auto-create or validate orchestrator agent
        let orchestratorAgentId = input.orchestratorAgentId;
        if (!orchestratorAgentId) {
            const gmPersona = buildOrchestratorPersona(input.title, input.setting);
            orchestratorAgentId = createCampaignAgent(id, `GM ${input.title}`, gmPersona, input.provider);
        } else if (!AgentManager.getAgent(orchestratorAgentId)) {
            throw new Error(`Orchestrator agent not found: ${orchestratorAgentId}`);
        }

        const config: CampaignConfig = {
            id,
            title: input.title,
            setting: input.setting,
            rules: input.rules,
            orchestratorAgentId,
            maxPcsAtOnce: input.maxPcsAtOnce || 6,
            seasonsPlanned: input.seasonsPlanned || 5,
            episodesPerSeason: input.episodesPerSeason || 12,
            roundsPerEpisode: input.roundsPerEpisode || 120,
            persistence: input.persistence,
            settings: input.settings,
            createdAt: now,
            updatedAt: now
        };

        // Store providers in config for future character creation
        if (input.providers) config.providers = input.providers;
        if (input.schedule) config.schedule = input.schedule;

        // Build initial characters — auto-create agents if no agentId provided
        // Rotate providers across characters for neuro-diversity
        const providerPool = input.providers || (input.provider ? [input.provider] : []);
        const characters: Character[] = (input.characters || []).map((c, idx) => {
            let agentId = c.agentId;
            if (!agentId) {
                const persona = buildCharacterPersona(c, input.setting);
                const charProvider = c.provider || (providerPool.length > 0 ? providerPool[idx % providerPool.length] : undefined);
                agentId = createCampaignAgent(id, c.name, persona, charProvider);
            } else if (!AgentManager.getAgent(agentId)) {
                throw new Error(`Agent not found for character "${c.name}": ${agentId}`);
            }
            return {
                ...c,
                agentId,
                id: randomUUID(),
                status: 'active' as const,
                introducedSeason: 1,
                introducedEpisode: 1,
                createdAt: now
            };
        });

        // Build initial seasons
        const seasons: SeasonArc[] = (input.seasons || [{ title: `Season 1`, arc: 'To be determined' }]).map((s, i) => ({
            season: i + 1,
            title: s.title,
            arc: s.arc,
            status: i === 0 ? 'active' as const : 'planned' as const,
            episodes: []
        }));

        const state: CampaignState = {
            id,
            currentSeason: 1,
            currentEpisode: 0,
            characters,
            seasons,
            worldState: input.initialWorldState || {},
            majorArc: input.majorArc,
            previouslyOn: [],
            createdAt: now,
            updatedAt: now
        };

        writeJSON(campaignConfigPath(id), config);
        writeJSON(campaignStatePath(id), state);

        logger.log({ type: 'system', level: 'info', message: `Campaign created: ${config.title}`, data: { id } });
        return config;
    }

    static delete(id: string): boolean {
        const dir = path.join(CAMPAIGNS_DIR, id);
        if (!fs.existsSync(dir)) return false;
        fs.rmSync(dir, { recursive: true, force: true });
        return true;
    }

    // ── Character Management ──

    static addCharacter(campaignId: string, character: Omit<Character, 'id' | 'status' | 'createdAt'> & { agentId?: string }): Character {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const activeCount = data.state.characters.filter(c => c.status === 'active').length;
        if (activeCount >= data.config.maxPcsAtOnce) {
            throw new Error(`Maximum active characters (${data.config.maxPcsAtOnce}) reached`);
        }

        // Auto-create agent if no agentId provided
        let agentId = character.agentId;
        if (!agentId) {
            const persona = buildCharacterPersona(character, data.config.setting);
            agentId = createCampaignAgent(campaignId, character.name, persona);
        } else if (!AgentManager.getAgent(agentId)) {
            throw new Error(`Agent not found: ${agentId}`);
        }

        const newChar: Character = {
            ...character,
            agentId,
            id: randomUUID(),
            status: 'active',
            createdAt: Date.now()
        };

        data.state.characters.push(newChar);
        data.state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), data.state);

        broadcastMessage({ type: 'campaign_character_added', campaignId, character: newChar });
        return newChar;
    }

    static killCharacter(campaignId: string, characterId: string, episodeId: string, description: string): Character | null {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const character = data.state.characters.find(c => c.id === characterId);
        if (!character) return null;

        character.status = 'dead';
        character.deathEpisode = episodeId;
        character.deathDescription = description;

        data.state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), data.state);

        broadcastMessage({ type: 'campaign_character_died', campaignId, character });
        logger.log({ type: 'system', level: 'info', message: `Character died: ${character.name}`, data: { campaignId, characterId, description } });
        return character;
    }

    /**
     * Update a character's sheet (stats, inventory, conditions, etc.)
     */
    static updateCharacter(campaignId: string, characterId: string, updates: Partial<Pick<
        Character, 'level' | 'xp' | 'stats' | 'abilities' | 'spells' | 'inventory' | 'equipped' |
        'conditions' | 'wounds' | 'warpExposure' | 'notes' | 'relationships' | 'traits' | 'background'
    >>): Character | null {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const character = data.state.characters.find(c => c.id === characterId);
        if (!character) return null;

        // Apply updates
        if (updates.level !== undefined) character.level = updates.level;
        if (updates.xp !== undefined) character.xp = updates.xp;
        if (updates.stats) character.stats = { ...character.stats, ...updates.stats };
        if (updates.abilities) character.abilities = updates.abilities;
        if (updates.spells) character.spells = updates.spells;
        if (updates.inventory) character.inventory = updates.inventory;
        if (updates.equipped) character.equipped = { ...character.equipped, ...updates.equipped };
        if (updates.conditions) character.conditions = updates.conditions;
        if (updates.wounds !== undefined) character.wounds = updates.wounds;
        if (updates.warpExposure !== undefined) character.warpExposure = updates.warpExposure;
        if (updates.notes) character.notes = updates.notes;
        if (updates.relationships) character.relationships = { ...character.relationships, ...updates.relationships };
        if (updates.traits) character.traits = updates.traits;
        if (updates.background) character.background = updates.background;

        data.state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), data.state);

        broadcastMessage({ type: 'campaign_character_updated', campaignId, character });
        return character;
    }

    /**
     * Get a single character's full sheet.
     */
    static getCharacter(campaignId: string, characterId: string): Character | null {
        const data = this.get(campaignId);
        if (!data) return null;
        return data.state.characters.find(c => c.id === characterId) || null;
    }

    static retireCharacter(campaignId: string, characterId: string): Character | null {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const character = data.state.characters.find(c => c.id === characterId);
        if (!character) return null;

        character.status = 'retired';
        data.state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), data.state);
        return character;
    }

    static getActiveCharacters(campaignId: string): Character[] {
        const data = this.get(campaignId);
        if (!data) return [];
        return data.state.characters.filter(c => c.status === 'active');
    }

    // ── Episode Management ──

    /**
     * Create and start the next episode in the campaign.
     * Builds a conversation from the campaign state, wiring in active characters as participants.
     */
    static async startNextEpisode(campaignId: string): Promise<{ conversationId: string; season: number; episode: number }> {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const { config, state } = data;
        const season = state.currentSeason;
        const episodeNum = state.currentEpisode + 1;

        if (episodeNum > config.episodesPerSeason) {
            throw new Error(`Season ${season} is complete (${config.episodesPerSeason} episodes). Advance to next season first.`);
        }

        const activeChars = state.characters.filter(c => c.status === 'active');
        if (activeChars.length === 0) {
            throw new Error('No active characters. Add characters before starting an episode.');
        }

        // Build participants from active characters, including how others see them
        const participants: ParticipantConfig[] = activeChars.map(c => {
            let notes = buildCharacterNotes(c);

            // Add how other characters feel about this character
            const othersView: string[] = [];
            for (const other of activeChars) {
                if (other.id === c.id) continue;
                const rel = other.relationships?.[c.name];
                if (rel) othersView.push(`- ${other.name}: ${rel}`);
            }
            if (othersView.length > 0) {
                notes += `\n\nHow others see you:\n${othersView.join('\n')}`;
            }

            return { agentId: c.agentId, role: c.name, characterNotes: notes };
        });

        // Build the orchestrator rules with campaign context
        const seasonArc = state.seasons.find(s => s.season === season);
        const campaignRules = buildCampaignRules(config, state, seasonArc, episodeNum);

        // Build the episode title
        const episodeTitle = `S${season}E${episodeNum}: ${config.title}`;

        // Build initial world state for this episode (carry over from campaign)
        const episodeWorldState = {
            ...state.worldState,
            _campaign: {
                season,
                episode: episodeNum,
                campaignId,
                activeCharacters: activeChars.map(c => ({
                    id: c.id,
                    name: c.name,
                    agentId: c.agentId,
                    class: c.class,
                    race: c.race,
                    level: c.level,
                    stats: c.stats,
                    inventory: c.inventory
                }))
            }
        };

        // Create the conversation (episode)
        const orchestrator: OrchestratorConfig = {
            type: 'agent',
            agentId: config.orchestratorAgentId,
            selectionStrategy: 'orchestrator',
            rules: campaignRules,
            closingStrategy: 'orchestrator-decides'
        };

        const convConfig = ConversationService.create({
            title: episodeTitle,
            format: 'roleplay',
            topic: `${config.title} — Season ${season}, Episode ${episodeNum}`,
            participants,
            orchestrator,
            settings: {
                maxRounds: config.roundsPerEpisode,
                minRounds: Math.floor(config.roundsPerEpisode * 0.15) || 15,
                enableTools: false,
                initialWorldState: episodeWorldState,
                campaignPersistence: config.persistence,
                ...(config.settings || {})
            }
        });

        // Update campaign state
        const seasonState = state.seasons.find(s => s.season === season);
        if (seasonState) {
            seasonState.episodes.push({
                episode: episodeNum,
                conversationId: convConfig.id,
                title: episodeTitle,
                status: 'active'
            });
            if (seasonState.status === 'planned') seasonState.status = 'active';
        }
        state.currentEpisode = episodeNum;
        state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), state);

        broadcastMessage({
            type: 'campaign_episode_started',
            campaignId,
            season,
            episode: episodeNum,
            conversationId: convConfig.id
        });

        // Fire and forget the conversation
        ConversationExecutor.run(convConfig.id).catch(() => {});

        return { conversationId: convConfig.id, season, episode: episodeNum };
    }

    /**
     * Called when an episode (conversation) completes.
     * Updates campaign state with results, carries over world state.
     */
    static completeEpisode(campaignId: string, conversationId: string, synopsis?: string): void {
        const data = this.get(campaignId);
        if (!data) return;

        const { state } = data;

        // Find the episode
        for (const season of state.seasons) {
            const ep = season.episodes.find(e => e.conversationId === conversationId);
            if (ep) {
                ep.status = 'complete';
                if (synopsis) ep.synopsis = synopsis;
                break;
            }
        }

        // Get the conversation state to carry over world state
        const convData = ConversationService.get(conversationId);
        if (convData?.state.worldState) {
            // Carry over world state, but strip the _campaign metadata
            const { _campaign, ...worldUpdates } = convData.state.worldState;
            state.worldState = deepMerge(state.worldState, worldUpdates);

            // Process any character events from the episode
            if (_campaign?.characterEvents) {
                for (const event of _campaign.characterEvents) {
                    if (event.type === 'death') {
                        this.killCharacter(campaignId, event.characterId, conversationId, event.description);
                    } else if (event.type === 'retire') {
                        this.retireCharacter(campaignId, event.characterId);
                    }
                }
            }

            // Process character sheet updates from the episode
            if (_campaign?.characterUpdates) {
                for (const upd of _campaign.characterUpdates) {
                    if (upd.characterId && upd.updates) {
                        this.updateCharacter(campaignId, upd.characterId, upd.updates);
                    }
                }
            }

            // Flag characters eligible for level-up (but don't apply — requires extended rest)
            for (const char of state.characters) {
                if (char.status !== 'active') continue;
                const xp = char.xp || 0;
                const lvl = char.level || 1;
                if (xp >= xpForLevel(lvl + 1)) {
                    logger.log({ type: 'system', level: 'info',
                        message: `[Campaign] ${char.name} is eligible to level up (XP: ${xp}/${xpForLevel(lvl + 1)}) — needs extended rest to consolidate` });
                }
            }
        }

        // Add to previouslyOn
        if (synopsis) {
            state.previouslyOn.push(synopsis);
            // Keep last 5 episode summaries for context
            if (state.previouslyOn.length > 5) {
                state.previouslyOn = state.previouslyOn.slice(-5);
            }
        }

        state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), state);

        broadcastMessage({ type: 'campaign_episode_complete', campaignId, conversationId });
    }

    /**
     * Advance to the next season.
     */
    static advanceSeason(campaignId: string): { season: number } {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const { config, state } = data;
        const nextSeason = state.currentSeason + 1;

        if (nextSeason > config.seasonsPlanned) {
            throw new Error(`Campaign only has ${config.seasonsPlanned} planned seasons`);
        }

        state.currentSeason = nextSeason;
        state.currentEpisode = 0;

        // Ensure season entry exists
        if (!state.seasons.find(s => s.season === nextSeason)) {
            state.seasons.push({
                season: nextSeason,
                title: `Season ${nextSeason}`,
                arc: 'To be determined',
                status: 'active',
                episodes: []
            });
        } else {
            const s = state.seasons.find(s => s.season === nextSeason)!;
            s.status = 'active';
        }

        // Mark previous season complete
        const prevSeason = state.seasons.find(s => s.season === state.currentSeason - 1);
        if (prevSeason) prevSeason.status = 'complete';

        state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), state);

        broadcastMessage({ type: 'campaign_season_advanced', campaignId, season: nextSeason });
        return { season: nextSeason };
    }

    /**
     * Update a season's arc description.
     */
    static updateSeasonArc(campaignId: string, season: number, title: string, arc: string): void {
        const data = this.get(campaignId);
        if (!data) throw new Error('Campaign not found');

        const seasonState = data.state.seasons.find(s => s.season === season);
        if (!seasonState) throw new Error(`Season ${season} not found`);

        seasonState.title = title;
        seasonState.arc = arc;
        data.state.updatedAt = Date.now();
        writeJSON(campaignStatePath(campaignId), data.state);
    }
}

// ── Helper Functions ────────────────────────────────────────────────────────

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
            result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
        ) {
            result[key] = deepMerge(result[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

function buildCharacterNotes(char: Character): string {
    let notes = `# CHARACTER SHEET: ${char.name}\n`;
    const lvl = char.level || 1;
    const xp = char.xp || 0;
    const nextLvlXp = xpToNextLevel(lvl);
    const eligible = xp >= nextLvlXp;
    notes += `Race: ${char.race || 'Unknown'} | Class: ${char.class || 'Unknown'} | Level: ${lvl} | XP: ${xp}/${nextLvlXp}${eligible ? ' ★ READY TO LEVEL UP (needs extended rest)' : ''}`;
    const cuf = char.stats?.CUF;
    if (cuf !== undefined) notes += ` | CUF: ${cuf}/20`;
    notes += '\n';

    if (char.stats) {
        const statStr = Object.entries(char.stats).map(([k, v]) => `${k}: ${v} (${v >= 10 ? '+' : ''}${Math.floor((v - 10) / 2)})`).join(', ');
        notes += `\nStats: ${statStr}`;
    }

    if (char.background) notes += `\n\nBackground: ${char.background}`;
    if (char.traits && char.traits.length > 0) notes += `\nTraits: ${char.traits.join(', ')}`;
    if (char.abilities && char.abilities.length > 0) notes += `\nAbilities: ${char.abilities.join(', ')}`;
    if (char.spells && char.spells.length > 0) notes += `\nSpells: ${char.spells.join(', ')}`;

    // Equipment
    if (char.equipped) {
        const eq: string[] = [];
        if (char.equipped.weapon) eq.push(`Weapon: ${char.equipped.weapon}`);
        if (char.equipped.armour) eq.push(`Armour: ${char.equipped.armour}`);
        if (char.equipped.shield) eq.push(`Shield: ${char.equipped.shield}`);
        if (char.equipped.accessories?.length) eq.push(`Accessories: ${char.equipped.accessories.join(', ')}`);
        if (eq.length > 0) notes += `\n\nEquipped: ${eq.join(' | ')}`;
    }
    if (char.inventory && char.inventory.length > 0) notes += `\nInventory: ${char.inventory.join(', ')}`;

    // Current condition
    if (char.wounds) notes += `\n\nWounds: ${char.wounds}/3 ${char.wounds >= 3 ? '(MORTAL DANGER)' : char.wounds >= 2 ? '(seriously hurt)' : '(wounded)'}`;
    if (char.warpExposure) {
        const warpDesc = char.warpExposure >= 9 ? 'CRITICAL — permanent effects imminent'
            : char.warpExposure >= 6 ? 'HIGH — mutation risk'
            : char.warpExposure >= 3 ? 'MODERATE — mild symptoms'
            : 'low';
        notes += `\nWarp Exposure: ${char.warpExposure}/10 (${warpDesc})`;
    }
    if (char.conditions && char.conditions.length > 0) notes += `\nConditions: ${char.conditions.join(', ')}`;

    // Relationships
    if (char.relationships && Object.keys(char.relationships).length > 0) {
        notes += '\n\nRelationships:';
        for (const [name, desc] of Object.entries(char.relationships)) {
            notes += `\n- ${name}: ${desc}`;
        }
    }

    // Persistent notes
    if (char.notes && char.notes.length > 0) {
        notes += '\n\nNotes:';
        for (const n of char.notes) notes += `\n- ${n}`;
    }

    return notes;
}

function buildCampaignRules(
    config: CampaignConfig,
    state: CampaignState,
    seasonArc: SeasonArc | undefined,
    episodeNum: number
): string {
    let rules = config.rules;

    rules += `\n\n# CAMPAIGN STRUCTURE
Major Arc: ${state.majorArc}
Season ${state.currentSeason} of ${config.seasonsPlanned}: ${seasonArc?.title || 'Untitled'}
Season Arc: ${seasonArc?.arc || 'Not yet defined'}
Episode ${episodeNum} of ${config.episodesPerSeason}
Setting: ${config.setting}`;

    if (state.previouslyOn.length > 0) {
        rules += `\n\n# PREVIOUSLY ON ${config.title.toUpperCase()}
${state.previouslyOn.map((s, i) => `Episode ${episodeNum - state.previouslyOn.length + i}: ${s}`).join('\n')}`;
    }

    // Character roster for the orchestrator
    const activeChars = state.characters.filter(c => c.status === 'active');
    const deadChars = state.characters.filter(c => c.status === 'dead');

    rules += `\n\n# ACTIVE CHARACTERS (${activeChars.length}/${config.maxPcsAtOnce} max)`;
    for (const c of activeChars) {
        rules += `\n- ${c.name} (${c.race || '?'} ${c.class || '?'}, L${c.level || 1}) — played by agent "${c.agentId}" [charId: ${c.id}]`;
    }

    if (deadChars.length > 0) {
        rules += `\n\n# FALLEN CHARACTERS`;
        for (const c of deadChars) {
            rules += `\n- ${c.name} (${c.class || '?'}) — ${c.deathDescription || 'died'}`;
        }
    }

    rules += `\n\n# CHARACTER MANAGEMENT
You can manage characters by including these in your response JSON:
- "killCharacter": { "characterId": "uuid", "description": "how they died" }
  Use this when a character dies. The system will mark them dead and remove them from the active roster.
  IMPORTANT: Characters SHOULD die. This is a dangerous world. Death should happen early and periodically.
  Death should be dramatic and meaningful, not gratuitous. Content rating is PG-13/15.
- "introduceCharacter": { "name": "...", "agentId": "...", "class": "...", "race": "...", "level": 1, "background": "...", "traits": [...], "stats": {...}, "inventory": [...] }
  When a character dies, you should introduce a replacement for that agent within 1-2 episodes.
  The agentId should be the same agent who lost their character (they need someone new to play).
  Maximum ${config.maxPcsAtOnce} active characters at once.
- "updateCharacter": { "characterId": "uuid", "updates": { ... } }
  Update a character's sheet after significant events. You SHOULD use this to track:
  - "wounds": number (0-3). Increment on serious injury, reset to 0 when healed.
  - "conditions": ["poisoned", "exhausted", etc.]. Set to current active conditions.
  - "inventory": updated item list when items are gained/lost/used.
  - "equipped": { "weapon": "...", "armour": "...", etc. } when gear changes.
  - "relationships": { "CharName": "relationship description" } — UPDATE EVERY EPISODE. Track how bonds evolve: trust, friction, loyalty, rivalry, romance, grudging respect. Relationships should deepen and change over time based on shared experiences. Include both PC-to-PC and PC-to-NPC relationships. Be specific ("trusts after she saved his life in the Ashmark", not just "friendly").
  - "notes": ["survived the Ashmark ambush", etc.] for significant story beats.
  - "level": only increment during genuine extended rest (days of downtime, between-season breaks, safe haven) where the character can consolidate and reflect. Do NOT force rest scenes for the sake of levelling — rest happens when the story allows it. If the pace is relentless, characters stay at their current level even if XP is sufficient. It is fine for characters to only level up between seasons.
    When levelling up, apply ONE of the following (choose what fits the character's growth this season):
    • +1 to a single stat that reflects how they've grown (a scholar who survived combat gets +1 WIL, not +1 STR)
    • A new ability or trait earned through play (not a menu pick — describe what they've learned)
    • +1 wound capacity (only at levels 5 and 9 — starts at 3)
  Keep character sheets updated — they persist across episodes and help maintain consistency.

# XP — MANDATORY
You MUST award XP to characters via "updateCharacters" throughout the episode. XP tracks character growth and is essential for progression. Do not wait until the end — award XP as notable moments happen.
SET "xp" to the character's NEW CUMULATIVE TOTAL (not an increment). Check each character's current XP in the world state and add to it.
- 1-2 XP: minor contributions (good roleplay moment, small discovery, helping an NPC)
- 3-5 XP: significant achievements (solving a puzzle, surviving a dangerous encounter, key story moment, meaningful character development)
- 5-8 XP: major milestones (defeating a serious threat, critical discovery, selfless sacrifice, completing a quest arc)
XP thresholds per level: L1→L2 needs 10 XP, L2→L3 needs 25, L3→L4 needs 50, L4→L5 needs 80.
Every character should earn at least some XP every episode. A typical episode awards 5-15 XP total per character.

# PACING
- This episode should be self-contained with a clear mini-arc (setup, conflict, resolution/cliffhanger)
- Aim for dramatic tension appropriate to a podcast episode (~30 minutes)
- End the episode (shouldEnd: true) when the mini-arc reaches a natural break point
- Don't rush — let characters breathe and interact, but keep momentum`;

    return rules;
}

// ── Campaign Agent Sync to GitHub ───────────────────────────────────────────

const activeAgentWatchers = new Map<string, fs.FSWatcher>();

function pushAgentFileToGitHub(repo: string, branch: string, ghPath: string, content: Buffer, message: string): Promise<void> {
    const { spawn } = require('child_process') as typeof import('child_process');
    const encoded = content.toString('base64');
    const apiPath = `/repos/${repo}/contents/${ghPath}`;

    return new Promise((resolve, reject) => {
        // Get SHA first
        const getSha = spawn('gh', ['api', apiPath, '-X', 'GET', '--jq', '.sha'], {
            stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000
        });
        let shaOut = '';
        getSha.stdout.on('data', (d: Buffer) => { shaOut += d.toString(); });
        getSha.on('close', () => {
            const sha = shaOut.trim().replace(/"/g, '') || undefined;
            const body: Record<string, any> = { message, content: encoded, branch };
            if (sha) body.sha = sha;

            const proc = spawn('gh', ['api', apiPath, '-X', 'PUT', '--input', '-'], {
                stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000
            });
            let stderr = '';
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
            proc.on('close', (code: number) => {
                if (code === 0) resolve();
                else reject(new Error(`gh api failed (${code}): ${stderr.substring(0, 300)}`));
            });
            proc.on('error', reject);
            proc.stdin.write(JSON.stringify(body));
            proc.stdin.end();
        });
        getSha.on('error', () => {
            // File doesn't exist yet, push without SHA
            const body = { message, content: encoded, branch };
            const proc = spawn('gh', ['api', apiPath, '-X', 'PUT', '--input', '-'], {
                stdio: ['pipe', 'pipe', 'pipe'], timeout: 60_000
            });
            let stderr = '';
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
            proc.on('close', (code: number) => {
                if (code === 0) resolve();
                else reject(new Error(stderr.substring(0, 300)));
            });
            proc.on('error', reject);
            proc.stdin.write(JSON.stringify(body));
            proc.stdin.end();
        });
    });
}

/**
 * Start file watchers on all campaign agent directories.
 * When any file changes (config.json, PERSONA.md, RULES.md, MEMORY.md),
 * sync it to GitHub under campaigns/<campaign-name>/characters/<agent-id>/.
 */
export function startCampaignAgentWatchers(): void {
    const campaigns = CampaignService.list();
    const skipFiles = new Set(['memory_index.db']);
    const syncTimeouts = new Map<string, NodeJS.Timeout>();

    for (const campaign of campaigns) {
        const persistence = campaign.persistence;
        if (!persistence?.repo || !process.env.GH_TOKEN) continue;

        const campaignName = campaign.title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
        const repo = persistence.repo;
        const branch = persistence.branch || 'main';
        const data = CampaignService.get(campaign.id);
        if (!data) continue;

        // Find all agents belonging to this campaign
        const agentIds = new Set<string>();
        agentIds.add(campaign.orchestratorAgentId);
        for (const char of data.state.characters) {
            if (char.agentId) agentIds.add(char.agentId);
        }

        for (const agentId of agentIds) {
            const agentDir = path.join(AGENTS_DIR, agentId);
            if (!fs.existsSync(agentDir)) continue;
            if (activeAgentWatchers.has(agentId)) continue;

            try {
                const watcher = fs.watch(agentDir, (_eventType, filename) => {
                    if (!filename || skipFiles.has(filename)) return;

                    // Debounce: wait 2s after last change before syncing
                    const key = `${agentId}/${filename}`;
                    const existing = syncTimeouts.get(key);
                    if (existing) clearTimeout(existing);

                    syncTimeouts.set(key, setTimeout(async () => {
                        syncTimeouts.delete(key);
                        const filePath = path.join(agentDir, filename);
                        if (!fs.existsSync(filePath)) return;

                        const ghPath = `campaigns/${campaignName}/characters/${agentId}/${filename}`;
                        try {
                            const content = fs.readFileSync(filePath);
                            await pushAgentFileToGitHub(repo, branch, ghPath, content,
                                `[OpenKiwi] Sync ${agentId}/${filename}`);
                            logger.log({ type: 'system', level: 'info',
                                message: `[Campaign] Synced ${agentId}/${filename} to GitHub` });
                        } catch (err) {
                            logger.log({ type: 'error', level: 'error',
                                message: `[Campaign] Failed to sync ${agentId}/${filename}`, data: String(err) });
                        }
                    }, 2000));
                });

                activeAgentWatchers.set(agentId, watcher);
                logger.log({ type: 'system', level: 'info',
                    message: `[Campaign] Watching agent ${agentId} for changes` });
            } catch (err) {
                logger.log({ type: 'error', level: 'error',
                    message: `[Campaign] Failed to watch agent ${agentId}`, data: String(err) });
            }
        }
    }
}
