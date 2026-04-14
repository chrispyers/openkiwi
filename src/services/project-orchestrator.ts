import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AgentManager } from '../agent-manager.js';
import { loadConfig } from '../config-manager.js';
import { runAgentLoop } from '../agent-loop.js';
import { broadcastMessage } from '../state.js';
import { logger } from '../logger.js';
import { WORKSPACE_DIR } from '../security.js';

const PROJECTS_DIR = path.join(WORKSPACE_DIR, 'projects');

// ── Types ────────────────────────────────────────────────────────

interface ProjectAgent {
    agentId: string;
    role: string;
}

interface ProjectConfig {
    agents: ProjectAgent[];
    roles: string[];
    status: string;
    maxRevisionsPerSprint: number;
    currentRunId: string | null;
}

interface ProjectRun {
    runId: string;
    projectName: string;
    abortController: AbortController;
    phase: 'planning' | 'working' | 'evaluating' | 'complete' | 'failed';
    sprint: number;
    revision: number;
    totalSprints: number;
    activeAgentId: string | null;
}

// ── Provider resolution (same pattern as delegation_tools.ts) ────

function resolveProvider(agentProvider?: string) {
    const config = loadConfig();
    let providerConfig = config.providers.find(
        (p: any) => p.model === agentProvider || p.description === agentProvider
    );
    if (!providerConfig && config.providers.length > 0) {
        providerConfig = config.providers[0];
    }
    return providerConfig || null;
}

// ── Config helpers ───────────────────────────────────────────────

function readProjectConfig(projectPath: string): ProjectConfig {
    const configPath = path.join(projectPath, 'project.json');
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {
            throw new Error('Failed to parse project.json');
        }
    }
    throw new Error('project.json not found');
}

function writeProjectConfig(projectPath: string, config: ProjectConfig): void {
    fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(config, null, 2), 'utf-8');
}

// ── Prompt templates ─────────────────────────────────────────────

function buildInitiatorPrompt(projectPath: string, projectName: string): string {
    const conceptPath = path.join(projectPath, '0-CONCEPT.md');
    const concept = fs.existsSync(conceptPath) ? fs.readFileSync(conceptPath, 'utf-8') : '';

    return `You are the Initiator for the project "${projectName}".

Your job is to read the project concept and produce:
1. A project spec file called \`spec.md\`
2. Sprint contract files for each sprint

## Instructions

Read the concept document below, then:

1. Write \`spec.md\` to the project directory. Include:
   - Project overview and goals
   - Feature breakdown
   - A line: \`## Sprint Count: N\` (where N is the number of sprints needed)
   - Brief description of what each sprint covers

2. For each sprint, write a file called \`sprint-N-contract.md\` (e.g., sprint-1-contract.md, sprint-2-contract.md). Each contract must include:
   - \`# Sprint N: <title>\`
   - \`## Acceptance Criteria\` with a checklist using \`- [ ]\` items
   - \`## Deliverables\` listing the expected output files/artifacts
   - Any constraints or requirements

## Project Directory
Write all files to: ${projectPath}

## Concept Document
${concept}`;
}

function buildWorkerPrompt(projectPath: string, sprint: number, revision: number): string {
    const contractPath = path.join(projectPath, `sprint-${sprint}-contract.md`);
    const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf-8') : '';

    const specPath = path.join(projectPath, 'spec.md');
    const spec = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf-8') : '';

    let feedback = '';
    if (revision > 0) {
        const evalPath = path.join(projectPath, `sprint-${sprint}-evaluation.md`);
        if (fs.existsSync(evalPath)) {
            feedback = `\n\n## Previous Evaluation Feedback\nThe evaluator rejected your previous work. Here is their feedback:\n\n${fs.readFileSync(evalPath, 'utf-8')}`;
        }
    }

    const workDir = path.join(projectPath, `sprint-${sprint}-work`);

    return `You are the Worker for this project. Your task is to complete Sprint ${sprint}.

Read the sprint contract carefully, then produce all deliverables it calls for — code, documents, research, designs, whatever the contract specifies.

## Instructions
- Write all output files to: ${workDir}
- Create the directory if it doesn't exist
- Address every acceptance criterion in the contract
- If this is a revision (attempt ${revision + 1}), carefully address all feedback from the previous evaluation
${feedback}

## Project Spec
${spec}

## Sprint Contract
${contract}`;
}

function buildEvaluatorPrompt(projectPath: string, sprint: number): string {
    const contractPath = path.join(projectPath, `sprint-${sprint}-contract.md`);
    const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf-8') : '';

    const workDir = path.join(projectPath, `sprint-${sprint}-work`);
    let deliverables = '';
    if (fs.existsSync(workDir)) {
        const files = fs.readdirSync(workDir, { recursive: true }) as string[];
        for (const file of files) {
            const filePath = path.join(workDir, file);
            if (fs.statSync(filePath).isFile()) {
                const content = fs.readFileSync(filePath, 'utf-8');
                deliverables += `\n### ${file}\n\`\`\`\n${content}\n\`\`\`\n`;
            }
        }
    }

    return `You are a skeptical Evaluator. Your job is to grade the Worker's deliverables for Sprint ${sprint} against the sprint contract.

## IMPORTANT
- Be critical and thorough. Do not praise work that doesn't meet the criteria.
- Evaluate each acceptance criterion individually.
- Agents tend to over-praise their own work — you exist to provide an honest, independent assessment.

## Instructions
Write your evaluation to: ${path.join(projectPath, `sprint-${sprint}-evaluation.md`)}

Use this EXACT format:

\`\`\`
# Evaluation: Sprint ${sprint}

## Result: PASS

or

## Result: FAIL

## Criteria Assessment
| Criterion | Status | Score | Notes |
|-----------|--------|-------|-------|
| ... | PASS/FAIL | N/10 | ... |

## Overall Score: N/10

## Feedback for Revision (if FAIL)
- Issue 1: ...
- Issue 2: ...
\`\`\`

## Sprint Contract
${contract}

## Deliverables
${deliverables || '(No deliverables found — this should be an automatic FAIL)'}`;
}

// ── Run an agent phase ───────────────────────────────────────────

async function runAgentPhase(
    agentId: string,
    task: string,
    sessionId: string,
    abortSignal: AbortSignal,
): Promise<string> {
    const agent = AgentManager.getAgent(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);

    const providerConfig = resolveProvider(agent.provider);
    if (!providerConfig) throw new Error(`No LLM provider for agent "${agentId}"`);

    const llmConfig = {
        baseUrl: providerConfig.endpoint,
        modelId: providerConfig.model,
        apiKey: providerConfig.apiKey,
        maxTokens: providerConfig.maxTokens,
        maxContextLength: providerConfig.max_context_length,
        supportsTools: !!providerConfig?.capabilities?.trained_for_tool_use,
    };

    const messages = [
        { role: 'system', content: agent.systemPrompt || `You are ${agent.name}, a helpful AI assistant.` },
        { role: 'user', content: task },
    ];

    AgentManager.setAgentState(agentId, 'working', 'Project orchestration');

    try {
        const result = await runAgentLoop({
            agentId,
            sessionId,
            llmConfig,
            messages,
            maxLoops: agent.maxLoops || 100,
            visionEnabled: !!providerConfig?.capabilities?.vision,
            abortSignal,
        });
        return result.finalResponse;
    } finally {
        AgentManager.setAgentState(agentId, 'idle');
    }
}

// ── Parse helpers ────────────────────────────────────────────────

function parseSprintCount(projectPath: string): number {
    const specPath = path.join(projectPath, 'spec.md');
    if (!fs.existsSync(specPath)) return 1;
    const content = fs.readFileSync(specPath, 'utf-8');
    const match = content.match(/##\s*Sprint\s*Count:\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
}

function parseEvaluationResult(projectPath: string, sprint: number): 'pass' | 'fail' {
    const evalPath = path.join(projectPath, `sprint-${sprint}-evaluation.md`);
    if (!fs.existsSync(evalPath)) return 'fail';
    const content = fs.readFileSync(evalPath, 'utf-8');
    if (/##\s*Result:\s*PASS/i.test(content)) return 'pass';
    return 'fail';
}

// ── Orchestrator ─────────────────────────────────────────────────

class ProjectOrchestratorService {
    private activeRuns = new Map<string, ProjectRun>();

    async startRun(projectName: string): Promise<{ runId: string }> {
        const projectPath = path.join(PROJECTS_DIR, projectName);
        if (!fs.existsSync(projectPath)) throw new Error('Project not found');

        const config = readProjectConfig(projectPath);
        if (config.currentRunId && this.activeRuns.has(config.currentRunId)) {
            throw new Error('A run is already active for this project');
        }

        const initiator = config.agents.find(a => a.role === 'Initiator');
        const worker = config.agents.find(a => a.role === 'Worker');
        if (!initiator) throw new Error('No agent with Initiator role assigned');
        if (!worker) throw new Error('No agent with Worker role assigned');

        const evaluator = config.agents.find(a => a.role === 'Evaluator');

        const runId = crypto.randomUUID();
        const abortController = new AbortController();

        const run: ProjectRun = {
            runId,
            projectName,
            abortController,
            phase: 'planning',
            sprint: 0,
            revision: 0,
            totalSprints: 0,
            activeAgentId: null,
        };

        this.activeRuns.set(runId, run);

        // Update project config
        config.status = 'planning';
        config.currentRunId = runId;
        writeProjectConfig(projectPath, config);

        // Run orchestration asynchronously
        this.executeRun(run, projectPath, config, initiator, worker, evaluator).catch(err => {
            logger.log({ type: 'error', level: 'error', message: `Project run ${runId} failed: ${err.message}` });
        });

        return { runId };
    }

    private async executeRun(
        run: ProjectRun,
        projectPath: string,
        config: ProjectConfig,
        initiator: ProjectAgent,
        worker: ProjectAgent,
        evaluator: ProjectAgent | undefined,
    ): Promise<void> {
        const { runId, projectName } = run;
        const broadcast = (phase: string, details: string) => {
            broadcastMessage({
                type: 'project_run_update',
                projectName,
                runId,
                phase,
                sprint: run.sprint,
                revision: run.revision,
                totalSprints: run.totalSprints,
                activeAgent: run.activeAgentId,
                details,
            });
        };

        try {
            // ── Phase 1: Planning ────────────────────────────────
            run.phase = 'planning';
            run.activeAgentId = initiator.agentId;
            broadcast('planning', `${initiator.agentId} is creating the project spec and sprint contracts`);

            const initiatorTask = buildInitiatorPrompt(projectPath, projectName);
            await runAgentPhase(
                initiator.agentId,
                initiatorTask,
                `project-${runId}-planning`,
                run.abortController.signal,
            );

            // Parse sprint count from spec
            run.totalSprints = parseSprintCount(projectPath);
            logger.log({ type: 'system', level: 'info', message: `[Orchestrator] ${projectName}: ${run.totalSprints} sprints planned` });

            // ── Phase 2: Sprint Loop ─────────────────────────────
            for (let sprint = 1; sprint <= run.totalSprints; sprint++) {
                if (run.abortController.signal.aborted) break;

                run.sprint = sprint;
                run.revision = 0;
                const maxRevisions = config.maxRevisionsPerSprint || 3;

                let passed = false;
                while (!passed && run.revision <= maxRevisions) {
                    if (run.abortController.signal.aborted) break;

                    // ── Work phase ───────────────────────────────
                    run.phase = 'working';
                    run.activeAgentId = worker.agentId;
                    config.status = 'sprinting';
                    writeProjectConfig(projectPath, config);
                    broadcast('working', `${worker.agentId} is working on Sprint ${sprint} (attempt ${run.revision + 1})`);

                    const workerTask = buildWorkerPrompt(projectPath, sprint, run.revision);
                    await runAgentPhase(
                        worker.agentId,
                        workerTask,
                        `project-${runId}-sprint${sprint}-rev${run.revision}`,
                        run.abortController.signal,
                    );

                    // ── Evaluate phase ───────────────────────────
                    if (evaluator) {
                        run.phase = 'evaluating';
                        run.activeAgentId = evaluator.agentId;
                        config.status = 'evaluating';
                        writeProjectConfig(projectPath, config);
                        broadcast('evaluating', `${evaluator.agentId} is evaluating Sprint ${sprint}`);

                        const evaluatorTask = buildEvaluatorPrompt(projectPath, sprint);
                        await runAgentPhase(
                            evaluator.agentId,
                            evaluatorTask,
                            `project-${runId}-sprint${sprint}-eval${run.revision}`,
                            run.abortController.signal,
                        );

                        const result = parseEvaluationResult(projectPath, sprint);
                        if (result === 'pass') {
                            passed = true;
                            broadcast('evaluating', `Sprint ${sprint} PASSED`);
                            logger.log({ type: 'system', level: 'info', message: `[Orchestrator] ${projectName}: Sprint ${sprint} passed` });
                        } else {
                            run.revision++;
                            broadcast('evaluating', `Sprint ${sprint} FAILED — revision ${run.revision}/${maxRevisions}`);
                            logger.log({ type: 'system', level: 'info', message: `[Orchestrator] ${projectName}: Sprint ${sprint} failed, revision ${run.revision}` });
                        }
                    } else {
                        // No evaluator — auto-pass
                        passed = true;
                    }
                }

                if (!passed) {
                    logger.log({ type: 'system', level: 'warn', message: `[Orchestrator] ${projectName}: Sprint ${sprint} failed after ${maxRevisions} revisions` });
                }
            }

            // ── Completion ───────────────────────────────────────
            run.phase = 'complete';
            run.activeAgentId = null;
            config.status = 'complete';
            config.currentRunId = null;
            writeProjectConfig(projectPath, config);
            broadcast('complete', 'Project run completed');
            logger.log({ type: 'system', level: 'info', message: `[Orchestrator] ${projectName}: Run ${runId} completed` });

        } catch (err: any) {
            if (run.abortController.signal.aborted) {
                config.status = 'idle';
                config.currentRunId = null;
                writeProjectConfig(projectPath, config);
                broadcast('stopped', 'Run was stopped');
                logger.log({ type: 'system', level: 'info', message: `[Orchestrator] ${projectName}: Run ${runId} stopped` });
            } else {
                run.phase = 'failed';
                config.status = 'failed';
                config.currentRunId = null;
                writeProjectConfig(projectPath, config);
                broadcast('failed', `Run failed: ${err.message}`);
                logger.log({ type: 'error', level: 'error', message: `[Orchestrator] ${projectName}: Run ${runId} failed: ${err.message}` });
            }
        } finally {
            this.activeRuns.delete(runId);
        }
    }

    getRunStatus(runId: string): ProjectRun | null {
        return this.activeRuns.get(runId) || null;
    }

    getActiveRunForProject(projectName: string): ProjectRun | null {
        for (const run of this.activeRuns.values()) {
            if (run.projectName === projectName) return run;
        }
        return null;
    }

    stopRun(runId: string): boolean {
        const run = this.activeRuns.get(runId);
        if (!run) return false;
        run.abortController.abort();
        return true;
    }
}

export const ProjectOrchestrator = new ProjectOrchestratorService();
