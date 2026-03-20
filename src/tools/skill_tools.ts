import path from 'node:path';
import { SkillManager } from '../skill-manager.js';

// Tracks activated skills per session to prevent duplicate context injection.
// Key: `${sessionId}:${skillName}`
const activatedSkills = new Set<string>();

export const activate_skill = {
    definition: {
        name: 'activate_skill',
        displayName: 'Skills: Activate',
        pluginType: 'skill',
        description: 'Load the full instructions for an Agent Skill. Call this when a user task matches one of the available skills listed in the system prompt.',
        parameters: {
            type: 'object' as const,
            properties: {
                skillName: {
                    type: 'string',
                    description: 'The name of the skill to activate (must match a discovered skill name exactly).'
                }
            },
            required: ['skillName']
        }
    },
    handler: async ({ skillName, _context }: { skillName: string, _context?: any }) => {
        if (!skillName) {
            return { error: 'skillName is required.' };
        }

        const dedupKey = `${_context?.sessionId ?? _context?.agentId ?? 'unknown'}:${skillName}`;
        if (activatedSkills.has(dedupKey)) {
            return {
                status: 'already_active',
                message: `Skill '${skillName}' is already loaded. Do not call activate_skill again — proceed directly with executing the skill instructions you already received.`
            };
        }
        activatedSkills.add(dedupKey);

        const content = SkillManager.getSkillContent(skillName);
        if (!content) {
            const available = SkillManager.getSkillDefinitions().map(s => s.name);
            return {
                error: `Skill '${skillName}' not found. Available skills: ${available.join(', ') || 'none'}.`
            };
        }

        const skillDef = SkillManager.getSkillDefinitions().find(s => s.name === skillName)!;

        const allowedTools = content.metadata['allowed-tools']
            ? content.metadata['allowed-tools'].split(/\s+/).filter(Boolean)
            : [];

        const scriptsPath = content.scriptFiles.length > 0
            ? path.join(skillDef.skillPath, 'scripts')
            : null;

        // Replace common portable path placeholders with the real path on this system
        let instructions = content.body;
        if (scriptsPath) {
            instructions = instructions.replace(
                new RegExp(`~/.claude/skills/${skillName}/scripts`, 'g'),
                scriptsPath
            );
        }

        return {
            name: content.metadata.name,
            description: content.metadata.description,
            instructions,
            allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
            available_scripts: content.scriptFiles,
            scripts_path: scriptsPath,
            available_references: content.referenceFiles,
            available_assets: content.assetFiles
        };
    }
};
