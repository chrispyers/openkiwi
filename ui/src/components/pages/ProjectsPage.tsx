import React, { useState, useEffect, useRef, useCallback } from 'react';
import { faPlus, faFolder, faSave, faEdit, faEye, faFileAlt, faUsers, faPlay, faTimes, faUserPlus, faTag, faStop, faSpinner, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'sonner';

import Page from './Page';
import Text from '../Text';
import Button from '../Button';
import Card from '../Card';
import Modal from '../Modal';
import Input from '../Input';
import Select from '../Select';
import MarkdownRenderer from '../MarkdownRenderer';
import type { Agent, ProjectConfig, ProjectAgent } from '../../types';

interface ProjectsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    agents: Agent[];
}

interface Project {
    name: string;
}

type Tab = 'files' | 'team';

export default function ProjectsPage({ gatewayAddr, gatewayToken, agents }: ProjectsPageProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [projectFiles, setProjectFiles] = useState<string[]>([]);
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('files');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Team state
    const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
    const [selectedNewAgentId, setSelectedNewAgentId] = useState('');
    const [selectedNewRole, setSelectedNewRole] = useState('');
    const [newRoleName, setNewRoleName] = useState('');

    // Run status
    interface RunStatus {
        active: boolean;
        runId?: string;
        phase?: string;
        sprint?: number;
        revision?: number;
        totalSprints?: number;
        activeAgent?: string;
        details?: string;
    }
    const [runStatus, setRunStatus] = useState<RunStatus>({ active: false });
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    // WebSocket listener for project run updates
    useEffect(() => {
        const wsUrl = gatewayAddr.replace(/^http/, 'ws') + '/ws';
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', token: gatewayToken }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'project_run_update' && msg.projectName === selectedProjectName) {
                    setRunStatus({
                        active: msg.phase !== 'complete' && msg.phase !== 'failed' && msg.phase !== 'stopped',
                        runId: msg.runId,
                        phase: msg.phase,
                        sprint: msg.sprint,
                        revision: msg.revision,
                        totalSprints: msg.totalSprints,
                        activeAgent: msg.activeAgent,
                        details: msg.details,
                    });

                    // Refresh file list when phase changes (new files may have been created)
                    if (selectedProjectName) {
                        fetchProjectDetails(selectedProjectName);
                    }

                    // Update project config status
                    if (msg.phase === 'complete' || msg.phase === 'failed' || msg.phase === 'stopped') {
                        setProjectConfig(prev => prev ? { ...prev, status: msg.phase === 'stopped' ? 'idle' : msg.phase, currentRunId: null } : prev);
                    }
                }
            } catch { /* ignore parse errors */ }
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [gatewayAddr, gatewayToken, selectedProjectName]);

    useEffect(() => {
        if (selectedProjectName) {
            fetchProjectDetails(selectedProjectName);
        } else {
            setProjectFiles([]);
            setProjectConfig(null);
            setSelectedFileName(null);
            setFileContent('');
            setIsEditing(false);
        }
    }, [selectedProjectName]);

    useEffect(() => {
        if (selectedProjectName && selectedFileName) {
            fetchFileContent(selectedProjectName, selectedFileName);
        } else {
            setFileContent('');
            setIsEditing(false);
        }
    }, [selectedFileName]);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            setProjects(data.map((name: string) => ({ name })));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load projects');
        }
    };

    const fetchProjectDetails = async (name: string) => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${name}`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch project');
            const data = await res.json();
            setProjectFiles(data.files || []);
            setProjectConfig(data.config || null);
            setSelectedFileName(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load project');
        }
    };

    const fetchFileContent = async (projectName: string, fileName: string) => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${projectName}/files/${fileName}`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch file content');
            const data = await res.json();
            setFileContent(data.content);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load file content');
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        try {
            setCreating(true);
            setError(null);
            const res = await fetch(`${gatewayAddr}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ name: newProjectName.trim() })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create project');
            }

            toast.success('Project created successfully');
            await fetchProjects();
            setSelectedProjectName(newProjectName.trim());
            setIsModalOpen(false);
            setNewProjectName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setCreating(false);
        }
    };

    const handleSaveFile = async () => {
        if (!selectedProjectName || !selectedFileName) return;

        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/files/${selectedFileName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ content: fileContent })
            });

            if (!res.ok) throw new Error('Failed to save file');

            toast.success('File saved successfully');
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save file');
        }
    };

    const saveAgents = async (updatedAgents: ProjectAgent[]) => {
        if (!selectedProjectName) return;
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/agents`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ agents: updatedAgents })
            });
            if (!res.ok) throw new Error('Failed to update agents');
            const data = await res.json();
            setProjectConfig(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update team');
        }
    };

    const saveRoles = async (updatedRoles: string[]) => {
        if (!selectedProjectName) return;
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/roles`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ roles: updatedRoles })
            });
            if (!res.ok) throw new Error('Failed to update roles');
            const data = await res.json();
            setProjectConfig(data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update roles');
        }
    };

    const handleAddAgent = () => {
        if (!selectedNewAgentId || !selectedNewRole || !projectConfig) return;
        const updatedAgents = [...projectConfig.agents, { agentId: selectedNewAgentId, role: selectedNewRole }];
        saveAgents(updatedAgents);
        setIsAddAgentModalOpen(false);
        setSelectedNewAgentId('');
        setSelectedNewRole('');
    };

    const handleRemoveAgent = (agentId: string) => {
        if (!projectConfig) return;
        const updatedAgents = projectConfig.agents.filter(a => a.agentId !== agentId);
        saveAgents(updatedAgents);
    };

    const handleChangeRole = (agentId: string, newRole: string) => {
        if (!projectConfig) return;
        const updatedAgents = projectConfig.agents.map(a =>
            a.agentId === agentId ? { ...a, role: newRole } : a
        );
        saveAgents(updatedAgents);
    };

    const handleAddRole = () => {
        const trimmed = newRoleName.trim();
        if (!trimmed || !projectConfig) return;
        if (projectConfig.roles.includes(trimmed)) {
            toast.error('Role already exists');
            return;
        }
        saveRoles([...projectConfig.roles, trimmed]);
        setNewRoleName('');
    };

    const handleRemoveRole = (role: string) => {
        if (!projectConfig) return;
        const hasAssigned = projectConfig.agents.some(a => a.role === role);
        if (hasAssigned) {
            toast.error('Cannot remove a role that is assigned to an agent');
            return;
        }
        saveRoles(projectConfig.roles.filter(r => r !== role));
    };

    const getAgentName = (agentId: string) => {
        const agent = agents.find(a => a.id === agentId);
        return agent?.name || agentId;
    };

    const getAgentAvatar = (agentId: string) => {
        const agent = agents.find(a => a.id === agentId);
        return agent?.avatar;
    };

    // Agents not yet assigned to this project
    const availableAgents = agents.filter(
        a => !projectConfig?.agents.some(pa => pa.agentId === a.id)
    );

    const hasInitiator = projectConfig?.agents.some(a => a.role === 'Initiator');
    const hasWorker = projectConfig?.agents.some(a => a.role === 'Worker');
    const isRunActive = runStatus.active || (projectConfig?.status !== 'idle' && projectConfig?.status !== 'complete' && projectConfig?.status !== 'failed');
    const canStartRun = hasInitiator && hasWorker && !isRunActive;

    const handleStartRun = async () => {
        if (!selectedProjectName) return;
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start run');
            }
            const data = await res.json();
            setRunStatus({ active: true, runId: data.runId, phase: 'planning', details: 'Starting...' });
            setProjectConfig(prev => prev ? { ...prev, status: 'planning', currentRunId: data.runId } : prev);
            toast.success('Run started');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start run');
        }
    };

    const handleStopRun = async () => {
        if (!selectedProjectName) return;
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/run/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
            });
            if (!res.ok) throw new Error('Failed to stop run');
            setRunStatus({ active: false });
            toast.success('Run stopped');
        } catch (err) {
            toast.error('Failed to stop run');
        }
    };

    return (
        <Page
            title="Projects"
            subtitle="Manage and organize your agent-led projects and workspace initiatives."
            headerAction={
                <Button themed={true} onClick={() => setIsModalOpen(true)} icon={faPlus}>
                    New Project
                </Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl h-[calc(100vh-12rem)] min-h-[500px]">
                {/* Left Column - Projects List */}
                <div className="lg:col-span-4 space-y-4">
                    <Card padding="p-4" className="space-y-1 h-full overflow-y-auto">
                        {projects.length === 0 ? (
                            <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                                <FontAwesomeIcon icon={faFolder} className="text-4xl text-neutral-300 dark:text-neutral-700" />
                                <Text secondary={true}>No projects yet</Text>
                            </div>
                        ) : (
                            projects.map((p) => (
                                <Button
                                    size="md"
                                    key={p.name}
                                    themed={selectedProjectName === p.name}
                                    className={`w-full !justify-start gap-3 !px-4 !py-3 ${selectedProjectName !== p.name ? 'hover:!bg-neutral-200 dark:hover:!bg-neutral-700' : ''}`}
                                    onClick={() => setSelectedProjectName(p.name)}
                                >
                                    <FontAwesomeIcon icon={faFolder} className={selectedProjectName === p.name ? "opacity-100" : "opacity-50"} />
                                    <div className="flex-1 text-left overflow-hidden min-w-0">
                                        <div className="truncate font-medium">{p.name}</div>
                                    </div>
                                </Button>
                            ))
                        )}
                    </Card>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-8 h-full flex flex-col gap-4">
                    {selectedProjectName ? (
                        <>
                            {/* Tab Bar */}
                            <div className="flex gap-2 shrink-0">
                                <Button
                                    size="sm"
                                    themed={activeTab === 'files'}
                                    onClick={() => setActiveTab('files')}
                                    icon={faFileAlt}
                                >
                                    Files
                                </Button>
                                <Button
                                    size="sm"
                                    themed={activeTab === 'team'}
                                    onClick={() => setActiveTab('team')}
                                    icon={faUsers}
                                >
                                    Team
                                </Button>
                            </div>

                            {activeTab === 'files' ? (
                                <>
                                    {/* File List Row */}
                                    <Card className="p-4 flex flex-wrap gap-2 shrink-0 border-b border-neutral-200 dark:border-neutral-800">
                                        {projectFiles.length === 0 ? (
                                            <Text secondary={true} className="italic">No files found.</Text>
                                        ) : (
                                            projectFiles.map(file => (
                                                <Button
                                                    key={file}
                                                    size="sm"
                                                    themed={selectedFileName === file}
                                                    onClick={() => setSelectedFileName(file)}
                                                    icon={faFileAlt}
                                                >
                                                    {file}
                                                </Button>
                                            ))
                                        )}
                                    </Card>

                                    {/* Editor Row */}
                                    <Card className="flex flex-col flex-1 !p-0 overflow-hidden">
                                        {selectedFileName ? (
                                            <>
                                                <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-sidebar">
                                                    <div className="flex items-center gap-3">
                                                        <Text bold={true} size="lg">{selectedFileName}</Text>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {isEditing ? (
                                                            <>
                                                                <Button size="sm" onClick={() => setIsEditing(false)} icon={faEye}>
                                                                    View
                                                                </Button>
                                                                <Button size="sm" themed={true} onClick={handleSaveFile} icon={faSave}>
                                                                    Save
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button size="sm" onClick={() => setIsEditing(true)} icon={faEdit}>
                                                                Edit
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto w-full relative">
                                                    {isEditing ? (
                                                        <textarea
                                                            className="absolute inset-0 w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-sm text-neutral-800 dark:text-neutral-200"
                                                            value={fileContent}
                                                            onChange={e => setFileContent(e.target.value)}
                                                            placeholder="Write your markdown here..."
                                                            spellCheck={false}
                                                        />
                                                    ) : (
                                                        <div className="p-6 h-full overflow-y-auto">
                                                            {fileContent ? (
                                                                <MarkdownRenderer content={fileContent} />
                                                            ) : (
                                                                <Text secondary={true} className="italic text-center mt-10 block">
                                                                    This file is empty. Click edit to start writing.
                                                                </Text>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-3xl h-full p-6">
                                                <Text secondary={true}>Select a file from the list above to view or edit</Text>
                                            </div>
                                        )}
                                    </Card>
                                </>
                            ) : activeTab === 'team' ? (
                                <Card className="flex flex-col flex-1 !p-0 overflow-hidden">
                                    {/* Team Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-sidebar">
                                        <Text bold={true} size="lg">Team</Text>
                                        <Button
                                            size="sm"
                                            themed={true}
                                            onClick={() => setIsAddAgentModalOpen(true)}
                                            icon={faUserPlus}
                                            disabled={availableAgents.length === 0}
                                        >
                                            Add Agent
                                        </Button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                        {/* Assigned Agents */}
                                        {projectConfig && projectConfig.agents.length > 0 ? (
                                            <div className="space-y-2">
                                                {projectConfig.agents.map((pa) => (
                                                    <div
                                                        key={pa.agentId}
                                                        className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
                                                    >
                                                        {getAgentAvatar(pa.agentId) ? (
                                                            <img
                                                                src={`${gatewayAddr}${getAgentAvatar(pa.agentId)}`}
                                                                alt=""
                                                                className="w-8 h-8 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center">
                                                                <Text size="sm" bold={true}>
                                                                    {getAgentName(pa.agentId).charAt(0).toUpperCase()}
                                                                </Text>
                                                            </div>
                                                        )}
                                                        <Text bold={true} className="flex-shrink-0">{getAgentName(pa.agentId)}</Text>
                                                        <div className="flex-1 min-w-0">
                                                            <Select
                                                                id={`role-${pa.agentId}`}
                                                                value={pa.role}
                                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChangeRole(pa.agentId, e.target.value)}
                                                                options={projectConfig.roles.map(r => ({ value: r, label: r }))}
                                                            />
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() => handleRemoveAgent(pa.agentId)}
                                                            icon={faTimes}
                                                            title="Remove agent"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                                                <FontAwesomeIcon icon={faUsers} className="text-4xl text-neutral-300 dark:text-neutral-700" />
                                                <Text secondary={true}>No agents assigned yet</Text>
                                                <Text secondary={true} size="sm">Add agents and assign them roles to get started.</Text>
                                            </div>
                                        )}

                                        {/* Roles Management */}
                                        {projectConfig && (
                                            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                                <Text bold={true} size="sm" className="mb-3 block uppercase tracking-wider">Roles</Text>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {projectConfig.roles.map(role => (
                                                        <span
                                                            key={role}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                                                        >
                                                            <FontAwesomeIcon icon={faTag} className="text-xs opacity-50" />
                                                            {role}
                                                            <button
                                                                onClick={() => handleRemoveRole(role)}
                                                                className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                                                                title={`Remove ${role} role`}
                                                            >
                                                                <FontAwesomeIcon icon={faTimes} className="text-xs" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        currentText={newRoleName}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoleName(e.target.value)}
                                                        clearText={() => setNewRoleName('')}
                                                        placeholder="New role name..."
                                                        icon={faTag}
                                                        inputClassName="!mt-0"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        themed={true}
                                                        onClick={handleAddRole}
                                                        disabled={!newRoleName.trim()}
                                                        icon={faPlus}
                                                        className="shrink-0"
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Run Status */}
                                        {runStatus.active && (
                                            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                                    <FontAwesomeIcon icon={faSpinner} className="text-blue-500 animate-spin" />
                                                    <div className="flex-1 min-w-0">
                                                        <Text bold={true} size="sm" className="block">
                                                            {runStatus.phase === 'planning' ? 'Planning' :
                                                             runStatus.phase === 'working' ? `Sprint ${runStatus.sprint}/${runStatus.totalSprints} — Working` :
                                                             runStatus.phase === 'evaluating' ? `Sprint ${runStatus.sprint}/${runStatus.totalSprints} — Evaluating` :
                                                             runStatus.phase || 'Running'}
                                                            {runStatus.revision && runStatus.revision > 0 ? ` (revision ${runStatus.revision})` : ''}
                                                        </Text>
                                                        {runStatus.activeAgent && (
                                                            <Text secondary={true} size="xs" className="block mt-0.5">
                                                                Active: {getAgentName(runStatus.activeAgent)}
                                                            </Text>
                                                        )}
                                                        {runStatus.details && (
                                                            <Text secondary={true} size="xs" className="block mt-0.5">
                                                                {runStatus.details}
                                                            </Text>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="danger"
                                                    className="w-full"
                                                    onClick={handleStopRun}
                                                    icon={faStop}
                                                >
                                                    Stop Run
                                                </Button>
                                            </div>
                                        )}

                                        {/* Completed/Failed Status */}
                                        {!runStatus.active && (projectConfig?.status === 'complete' || projectConfig?.status === 'failed') && (
                                            <div className={`border-t border-neutral-200 dark:border-neutral-700 pt-4`}>
                                                <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                                    projectConfig.status === 'complete'
                                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                        : 'bg-rose-500/10 border border-rose-500/20'
                                                }`}>
                                                    <FontAwesomeIcon
                                                        icon={projectConfig.status === 'complete' ? faCheckCircle : faExclamationCircle}
                                                        className={projectConfig.status === 'complete' ? 'text-emerald-500' : 'text-rose-500'}
                                                    />
                                                    <Text bold={true} size="sm">
                                                        {projectConfig.status === 'complete' ? 'Run completed' : 'Run failed'}
                                                    </Text>
                                                </div>
                                            </div>
                                        )}

                                        {/* Start Run Button */}
                                        {projectConfig && projectConfig.agents.length > 0 && !runStatus.active && (
                                            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                                <Button
                                                    themed={true}
                                                    className="w-full"
                                                    onClick={handleStartRun}
                                                    disabled={!canStartRun}
                                                    icon={faPlay}
                                                >
                                                    {projectConfig.status === 'complete' || projectConfig.status === 'failed' ? 'Run Again' : 'Start Run'}
                                                </Button>
                                                {!hasInitiator && (
                                                    <Text secondary={true} size="xs" className="mt-2 block text-center">
                                                        Assign an agent with the Initiator role to start a run.
                                                    </Text>
                                                )}
                                                {hasInitiator && !hasWorker && (
                                                    <Text secondary={true} size="xs" className="mt-2 block text-center">
                                                        Assign an agent with the Worker role to start a run.
                                                    </Text>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ) : null}
                        </>
                    ) : (
                        <Card className="flex flex-col h-full items-center justify-center bg-card rounded-3xl !border-0 p-6">
                            <FontAwesomeIcon icon={faFolder} className="text-5xl text-neutral-200 dark:text-neutral-800 mb-4" />
                            <Text secondary={true}>Select a project to view files</Text>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create Project Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setNewProjectName('');
                    setError(null);
                }}
                title="Create New Project"
                className="!max-w-md"
            >
                <div className="p-6 space-y-6">
                    <Text size="sm">
                        Enter a short name for your new project. Alphanumeric characters, spaces, dashes, and underscores are allowed.
                    </Text>

                    <Input
                        label="Project Name"
                        currentText={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                        clearText={() => setNewProjectName('')}
                        placeholder="e.g., Launch Plan"
                        icon={faFolder}
                        inputClassName="!mt-0"
                    />

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                            <p className="text-sm text-rose-500">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            themed={false}
                            className="flex-1"
                            onClick={() => {
                                setIsModalOpen(false);
                                setNewProjectName('');
                                setError(null);
                            }}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            themed={true}
                            className="flex-1"
                            onClick={handleCreateProject}
                            disabled={creating || !newProjectName.trim()}
                            icon={creating ? undefined : faPlus}
                        >
                            {creating ? 'Creating...' : 'Create Project'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Add Agent Modal */}
            <Modal
                isOpen={isAddAgentModalOpen}
                onClose={() => {
                    setIsAddAgentModalOpen(false);
                    setSelectedNewAgentId('');
                    setSelectedNewRole('');
                }}
                title="Add Agent to Team"
                className="!max-w-md"
            >
                <div className="p-6 space-y-6">
                    <Select
                        id="add-agent-select"
                        label="Agent"
                        value={selectedNewAgentId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedNewAgentId(e.target.value)}
                        options={[
                            { value: '', label: 'Select an agent...' },
                            ...availableAgents.map(a => ({ value: a.id, label: a.name }))
                        ]}
                    />

                    <Select
                        id="add-role-select"
                        label="Role"
                        value={selectedNewRole}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedNewRole(e.target.value)}
                        options={[
                            { value: '', label: 'Select a role...' },
                            ...(projectConfig?.roles || []).map(r => ({ value: r, label: r }))
                        ]}
                    />

                    <div className="flex gap-3">
                        <Button
                            themed={false}
                            className="flex-1"
                            onClick={() => {
                                setIsAddAgentModalOpen(false);
                                setSelectedNewAgentId('');
                                setSelectedNewRole('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            themed={true}
                            className="flex-1"
                            onClick={handleAddAgent}
                            disabled={!selectedNewAgentId || !selectedNewRole}
                            icon={faUserPlus}
                        >
                            Add to Team
                        </Button>
                    </div>
                </div>
            </Modal>
        </Page>
    );
}
