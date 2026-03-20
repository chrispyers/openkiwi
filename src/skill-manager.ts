import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface SkillMetadata {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    'allowed-tools'?: string;
}

export interface SkillDefinition {
    name: string;
    description: string;
    skillPath: string;
}

export interface SkillContent {
    metadata: SkillMetadata;
    body: string;
    scriptFiles: string[];
    referenceFiles: string[];
    assetFiles: string[];
}

const SKILLS_DIR = path.resolve(process.cwd(), 'skills');

export class SkillManager {
    private static skills: Map<string, { metadata: SkillMetadata; skillPath: string }> = new Map();

    static async discoverSkills(): Promise<void> {
        this.skills.clear();
        if (!fs.existsSync(SKILLS_DIR)) {
            fs.mkdirSync(SKILLS_DIR, { recursive: true });
            return;
        }

        const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillPath = path.join(SKILLS_DIR, entry.name);
            const skillMdPath = path.join(skillPath, 'SKILL.md');
            if (!fs.existsSync(skillMdPath)) continue;

            try {
                const fileContent = fs.readFileSync(skillMdPath, 'utf-8');
                const metadata = parseFrontmatter(fileContent);

                if (!metadata) {
                    console.warn(`[SkillManager] Skipping ${entry.name}: invalid or missing frontmatter`);
                    continue;
                }

                if (metadata.name !== entry.name) {
                    console.warn(`[SkillManager] Skipping ${entry.name}: SKILL.md name '${metadata.name}' doesn't match directory name`);
                    continue;
                }

                this.skills.set(metadata.name, { metadata, skillPath });
                console.log(`[SkillManager] Discovered skill: ${metadata.name}`);
            } catch (err: any) {
                console.error(`[SkillManager] Failed to load skill ${entry.name}:`, err.message);
            }
        }

        console.log(`[SkillManager] Discovered ${this.skills.size} skill(s)`);
    }

    static getSkillDefinitions(): SkillDefinition[] {
        return Array.from(this.skills.values()).map(s => ({
            name: s.metadata.name,
            description: s.metadata.description,
            skillPath: s.skillPath
        }));
    }

    static getSkillContent(skillName: string): SkillContent | null {
        const skill = this.skills.get(skillName);
        if (!skill) return null;

        const skillMdPath = path.join(skill.skillPath, 'SKILL.md');
        const fileContent = fs.readFileSync(skillMdPath, 'utf-8');
        const body = extractBody(fileContent);

        const scriptFiles = listDirFiles(path.join(skill.skillPath, 'scripts'));
        const referenceFiles = listDirFiles(path.join(skill.skillPath, 'references'));
        const assetFiles = listDirFiles(path.join(skill.skillPath, 'assets'));

        return {
            metadata: skill.metadata,
            body,
            scriptFiles,
            referenceFiles,
            assetFiles
        };
    }
}

function parseFrontmatter(content: string): SkillMetadata | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    try {
        const parsed = parseYaml(match[1]) as any;
        if (!parsed?.name || !parsed?.description) return null;
        return parsed as SkillMetadata;
    } catch {
        return null;
    }
}

function extractBody(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
}

function listDirFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(e => e.isFile())
        .map(e => e.name);
}
