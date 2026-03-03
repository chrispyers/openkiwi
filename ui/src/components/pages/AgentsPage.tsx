import { useState, useEffect } from 'react'
import { faPlus, faUser, faSmile, faSave, faClock, faBrain, faMicrochip, faHeartPulse, faTrash, faIdBadge, faShield, faClockFour, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../Button'
import Card from '../Card'
import Text from '../Text'
import Modal from '../Modal'
import Input from '../Input'
import Toggle from '../Toggle'
import Page from './Page'
import Select from '../Select'
import AgentFileButton from '../AgentFileButton'
import Code from '../Code'
import { EyeIcon, BrainIcon, ToolIcon } from '../CapabilityIcons'

import { toast } from 'sonner'
import { Agent, AgentState } from '../../types'


interface AgentsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    agentForm: { name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; }; collaboration?: { enabled: boolean; schedule: string; } }>>
    saveAgentConfig: () => Promise<void>;
    fetchAgents: () => Promise<void>;
    selectedAgentId: string;
    setSelectedAgentId: (id: string) => void;
    providers: {
        description: string;
        endpoint: string;
        model: string;
        capabilities?: {
            vision?: boolean;
            reasoning?: boolean;
            trained_for_tool_use?: boolean;
        }
    }[];
    isAgentCollaborationEnabled: boolean;
}

export default function AgentsPage({
    gatewayAddr,
    gatewayToken,
    setViewingFile,
    agentForm,
    setAgentForm,
    saveAgentConfig,
    fetchAgents,
    selectedAgentId: selectedAgentIdFromParent,
    setSelectedAgentId: setSelectedAgentIdFromParent,
    providers,
    agents,
    isAgentCollaborationEnabled,
    allowManualHeartbeat,
    agentStates
}: AgentsPageProps & { agents: Agent[], allowManualHeartbeat: boolean, agentStates: Record<string, AgentState> }) {
    // Remove local agents state
    // const [agents, setAgents] = useState<Agent[]>([])
    // Remove local loading state as we rely on parent's data or we can keep it if we want to show loading while fetching
    const [loading, setLoading] = useState(false) // Default to false as data typically passed from parent
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newAgentName, setNewAgentName] = useState('')
    const [newAgentPersona, setNewAgentPersona] = useState('Generic')
    const [personas, setPersonas] = useState<string[]>(['Generic'])
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deletingAgent, setDeletingAgent] = useState(false)
    const [isHeartbeatModalOpen, setIsHeartbeatModalOpen] = useState(false)
    const [triggeringHeartbeat, setTriggeringHeartbeat] = useState(false)

    // Use selectedAgentId from props
    const selectedAgentId = selectedAgentIdFromParent
    const setSelectedAgentId = setSelectedAgentIdFromParent

    const selectedAgent = agents.find(a => a.id === selectedAgentId)

    // Update agentForm when selected agent changes
    useEffect(() => {
        if (selectedAgent) {
            setAgentForm({
                name: selectedAgent.name,
                emoji: selectedAgent.emoji,
                provider: selectedAgent.provider || '',
                heartbeat: selectedAgent.heartbeat || { enabled: false, schedule: '* * * * *' },
                collaboration: selectedAgent.collaboration || { enabled: false, schedule: '* * * * *' }
            })
        }
    }, [selectedAgent, setAgentForm])

    // Use parent's fetchAgents directly

    const createAgent = async () => {
        if (!newAgentName.trim()) {
            setError('Please enter an agent name')
            return
        }

        try {
            setCreating(true)
            setError(null)
            const response = await fetch(`${gatewayAddr}/api/agents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ name: newAgentName.trim(), persona: newAgentPersona })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to create agent')
            }

            const newAgent = await response.json()
            // Update parent's agents state
            await fetchAgents()
            setSelectedAgentId(newAgent.id)
            setIsModalOpen(false)
            setNewAgentName('')
            setNewAgentPersona('Generic')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to create agent')
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteAgent = async () => {
        if (!selectedAgentId) return

        try {
            setDeletingAgent(true)
            const response = await fetch(`${gatewayAddr}/api/agents/${selectedAgentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${gatewayToken}`
                }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to delete agent')
            }

            await fetchAgents()
            setSelectedAgentId('')
            setIsDeleteModalOpen(false)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to delete agent')
        } finally {
            setDeletingAgent(false)
        }
    }

    const handleTriggerHeartbeat = async () => {
        if (!selectedAgentId) return

        try {
            setTriggeringHeartbeat(true)
            const response = await fetch(`${gatewayAddr}/api/agents/${selectedAgentId}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gatewayToken}`
                }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to trigger heartbeat')
            }

            toast.success(`Heartbeat triggered for ${selectedAgent?.name}`, {
                description: 'The scheduled task is now running in the background.'
            })
            setIsHeartbeatModalOpen(false)
        } catch (error) {
            toast.error('Failed to trigger heartbeat', {
                description: error instanceof Error ? error.message : 'Unknown error'
            })
        } finally {
            setTriggeringHeartbeat(false)
        }
    }

    useEffect(() => {
        fetchAgents()
        fetch(`${gatewayAddr}/api/agents/personas`, {
            headers: { 'Authorization': `Bearer ${gatewayToken}` }
        })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setPersonas(data);
            })
            .catch(console.error)
    }, [])

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12">
                <p className="font-medium">Loading agents...</p>
            </div>
        )
    }

    return (
        <Page
            title="Agents"
            subtitle="Manage your AI agent personalities and configurations."
            headerAction={
                <Button themed={true} onClick={() => setIsModalOpen(true)} icon={faPlus}>Add Agent</Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl">
                {/* Left Column - Discovered Agents */}
                <div className="lg:col-span-4 space-y-4">
                    <Card padding="p-4" className="space-y-1 h-min max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {agents.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <Text secondary={true}>No agents discovered yet</Text>
                            </div>
                        ) : (
                            agents.map(a => {
                                const provider = providers.find(p => p.description === a.provider);
                                return (
                                    <Button
                                        size="md"
                                        key={a.id}
                                        themed={selectedAgentId === a.id}
                                        className={`w-full !justify-start gap-3 !px-4 !py-3 ${selectedAgentId !== a.id ? 'hover:!bg-neutral-200 dark:hover:!bg-neutral-700' : ''}`}
                                        onClick={() => setSelectedAgentId(a.id)}
                                    >
                                        <div className="flex-1 text-left overflow-hidden min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="truncate font-medium">
                                                    {a.name}
                                                    {a.heartbeat?.enabled && (
                                                        <span className="opacity-50 ml-1.5 text-xs">
                                                            <FontAwesomeIcon icon={faClockFour} />
                                                        </span>
                                                    )}
                                                </div>

                                                {provider?.capabilities && (
                                                    <div className="flex gap-1 shrink-0 opacity-70">
                                                        {provider.capabilities.vision && <EyeIcon small={true} noTooltip={true} />}
                                                        {provider.capabilities.trained_for_tool_use && <ToolIcon small={true} noTooltip={true} />}
                                                        {provider.capabilities.reasoning && <BrainIcon small={true} noTooltip={true} />}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="truncate -mt-1">
                                                <Text secondary={true} size="sm">{a.provider || 'Global Default'}</Text>
                                            </div>
                                        </div>
                                    </Button>
                                );
                            })
                        )}
                    </Card>


                </div>

                {/* Right Column - Agent Details */}
                <div className="lg:col-span-8">
                    {selectedAgent ? (
                        <>
                            <Card className="space-y-6 mb-6">
                                <div className="flex items-center gap-3">
                                    <Text bold={true} size="xl">{selectedAgent.name}</Text>
                                    <span className="text-3xl ml-2">{selectedAgent.emoji}</span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <Input
                                                label="Agent Nickname"
                                                currentText={agentForm.name}
                                                onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                                clearText={() => setAgentForm({ ...agentForm, name: '' })}
                                                icon={faUser}
                                                className="md:col-span-2"
                                                inputClassName="!mt-0"
                                            />
                                            <Input
                                                label="Emoji Icon"
                                                currentText={agentForm.emoji}
                                                onChange={e => setAgentForm({ ...agentForm, emoji: e.target.value })}
                                                clearText={() => setAgentForm({ ...agentForm, emoji: '' })}
                                                icon={faSmile}
                                                inputClassName="!mt-0 font-emoji text-center pl-0"
                                            />
                                        </div>

                                            {(agentForm.heartbeat?.enabled) && (
                                                <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <Input
                                                        label="Cron Schedule"
                                                        icon={faClock}
                                                        currentText={agentForm.heartbeat?.schedule || ''}
                                                        onChange={e => setAgentForm({
                                                            ...agentForm,
                                                            heartbeat: {
                                                                ...agentForm.heartbeat!,
                                                                schedule: e.target.value
                                                            }
                                                        })}
                                                        clearText={() => setAgentForm({
                                                            ...agentForm,
                                                            heartbeat: {
                                                                ...agentForm.heartbeat!,
                                                                schedule: ''
                                                            }
                                                        })}
                                                        placeholder="e.g. */10 * * * *"
                                                        className="!mt-0"
                                                    />
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            { label: 'Every 10m', val: '*/10 * * * *' },
                                                            { label: 'Hourly', val: '0 * * * *' },
                                                            { label: 'Every 4h', val: '0 */4 * * *' },
                                                            { label: 'Every 12h', val: '0 */12 * * *' },
                                                            { label: 'Midnight', val: '0 0 * * *' }
                                                        ].map(opt => (
                                                            <Button
                                                                size="sm"
                                                                key={opt.label}
                                                                onClick={() => setAgentForm({
                                                                    ...agentForm,
                                                                    heartbeat: {
                                                                        ...agentForm.heartbeat!,
                                                                        schedule: opt.val
                                                                    }
                                                                })}
                                                            >
                                                                {opt.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg  dark:border-neutral-700/50">
                                                        <Text size="xs" bold={true} className="uppercase mb-2 block opacity-70">Cron Reference</Text>
                                                        <div className="grid grid-cols-5 gap-1 text-[10px] font-mono text-center uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                                                            <div>min</div>
                                                            <div>hour</div>
                                                            <div>day</div>
                                                            <div>month</div>
                                                            <div>week</div>
                                                        </div>
                                                        <div className="grid grid-cols-5 gap-1 font-mono text-center py-1 bg-neutral-100 dark:bg-neutral-900/50 rounded border border-neutral-200 dark:border-neutral-800">
                                                            <Text>*</Text>
                                                            <Text>*</Text>
                                                            <Text>*</Text>
                                                            <Text>*</Text>
                                                            <Text>*</Text>
                                                        </div>
                                                        <div className="mt-2 text-center">
                                                            <Text size="sm" secondary={true}>e.g., <Code>0 12 * * *</Code> runs every day at noon.</Text>
                                                        </div>
                                                    </div>

                                                    {allowManualHeartbeat && (() => {
                                                        const agentState = selectedAgentId ? agentStates[selectedAgentId] : undefined
                                                        const isRunning = agentState?.status === 'working'
                                                        return (
                                                            <Button
                                                                size="md"
                                                                className={`w-full ${isRunning
                                                                    ? '!bg-amber-500/10 !text-amber-600 dark:!text-amber-400'
                                                                    : '!bg-emerald-500/10 hover:!bg-emerald-500/20 dark:!bg-emerald-500/10 dark:hover:!bg-emerald-500/20 !text-emerald-600 dark:!text-emerald-400'
                                                                }`}
                                                                onClick={() => setIsHeartbeatModalOpen(true)}
                                                                icon={faPlay}
                                                                disabled={isRunning}
                                                            >
                                                                {isRunning ? 'Running...' : 'Run Now'}
                                                            </Button>
                                                        )
                                                    })()}

                                                </div>
                                            )}
                                        </div>

                                        <div className="mb-4">
                                            <Select
                                                label="Model"
                                                value={agentForm.provider || ''}
                                                onChange={(e) => setAgentForm({ ...agentForm, provider: e.target.value })}
                                                options={[
                                                    { value: '', label: 'Use Global Default' },
                                                    ...providers.map(p => ({
                                                        value: p.description,
                                                        label: p.description
                                                    }))
                                                ]}
                                            />
                                        </div>
                                        <Button
                                            themed={true}
                                            className="w-full"
                                            onClick={saveAgentConfig}
                                            icon={faSave}
                                        >
                                            Update Agent Profile
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            <Card className="space-y-6 mb-6">
                                <div className="bg-white dark:bg-bg-primary rounded-xl p-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <Text bold={true}>
                                                <FontAwesomeIcon className="mr-2" icon={faClockFour} />Scheduled Tasks</Text>
                                            <div className="mb-2">
                                                <Text size="sm" secondary={true}>Allows the agent to perform automated tasks on a schedule</Text>
                                            </div>
                                        </div>
                                        <Toggle
                                            checked={agentForm.heartbeat?.enabled || false}
                                            onChange={() => setAgentForm({
                                                ...agentForm,
                                                heartbeat: {
                                                    schedule: agentForm.heartbeat?.schedule || '* * * * *',
                                                    enabled: !(agentForm.heartbeat?.enabled)
                                                }
                                            })}
                                        />
                                    </div>

                                    {(agentForm.heartbeat?.enabled) && (
                                        <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <Input
                                                label="Cron Schedule"
                                                icon={faClock}
                                                currentText={agentForm.heartbeat?.schedule || ''}
                                                onChange={e => setAgentForm({
                                                    ...agentForm,
                                                    heartbeat: {
                                                        ...agentForm.heartbeat!,
                                                        schedule: e.target.value
                                                    }
                                                })}
                                                clearText={() => setAgentForm({
                                                    ...agentForm,
                                                    heartbeat: {
                                                        ...agentForm.heartbeat!,
                                                        schedule: ''
                                                    }
                                                })}
                                                placeholder="e.g. */10 * * * *"
                                                className="!mt-0"
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { label: 'Every 10m', val: '*/10 * * * *' },
                                                    { label: 'Hourly', val: '0 * * * *' },
                                                    { label: 'Every 4h', val: '0 */4 * * *' },
                                                    { label: 'Every 12h', val: '0 */12 * * *' },
                                                    { label: 'Midnight', val: '0 0 * * *' }
                                                ].map(opt => (
                                                    <Button
                                                        size="sm"
                                                        key={opt.label}
                                                        onClick={() => setAgentForm({
                                                            ...agentForm,
                                                            heartbeat: {
                                                                ...agentForm.heartbeat!,
                                                                schedule: opt.val
                                                            }
                                                        })}
                                                    >
                                                        {opt.label}
                                                    </Button>
                                                ))}
                                            </div>
                                            <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg  dark:border-neutral-700/50">
                                                <Text size="xs" bold={true} className="uppercase mb-2 block opacity-70">Cron Reference</Text>
                                                <div className="grid grid-cols-5 gap-1 text-[10px] font-mono text-center uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                                                    <div>min</div>
                                                    <div>hour</div>
                                                    <div>day</div>
                                                    <div>month</div>
                                                    <div>week</div>
                                                </div>
                                                <div className="grid grid-cols-5 gap-1 font-mono text-center py-1 bg-neutral-100 dark:bg-neutral-900/50 rounded border border-neutral-200 dark:border-neutral-800">
                                                    <Text>*</Text>
                                                    <Text>*</Text>
                                                    <Text>*</Text>
                                                    <Text>*</Text>
                                                    <Text>*</Text>
                                                </div>
                                                <div className="mt-2 text-center">
                                                    <Text size="sm" secondary={true}>e.g., <Code>0 12 * * *</Code> runs every day at noon.</Text>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>

                                {isAgentCollaborationEnabled && (
                                    <div className="bg-white dark:bg-bg-primary rounded-xl p-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <Text bold={true}>
                                                    <FontAwesomeIcon className="mr-2" icon={faUsers} />Agent Collaboration</Text>
                                                <div className="mb-2">
                                                    <Text size="sm" secondary={true}>Allows the agent to participate in multi-step workflows with other agents</Text>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={agentForm.collaboration?.enabled || false}
                                                onChange={() => setAgentForm({
                                                    ...agentForm,
                                                    collaboration: {
                                                        schedule: agentForm.collaboration?.schedule || '* * * * *',
                                                        enabled: !(agentForm.collaboration?.enabled)
                                                    }
                                                })}
                                            />
                                        </div>

                                        {(agentForm.collaboration?.enabled) && (
                                            <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <Input
                                                    label="Collaboration Check Interval (Cron)"
                                                    icon={faClock}
                                                    currentText={agentForm.collaboration?.schedule || ''}
                                                    onChange={e => setAgentForm({
                                                        ...agentForm,
                                                        collaboration: {
                                                            ...agentForm.collaboration!,
                                                            schedule: e.target.value
                                                        }
                                                    })}
                                                    clearText={() => setAgentForm({
                                                        ...agentForm,
                                                        collaboration: {
                                                            ...agentForm.collaboration!,
                                                            schedule: ''
                                                        }
                                                    })}
                                                    placeholder="e.g. */10 * * * *"
                                                    className="!mt-0"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { label: 'Every 5m', val: '*/5 * * * *' },
                                                        { label: 'Every 15m', val: '*/15 * * * *' },
                                                        { label: 'Hourly', val: '0 * * * *' }
                                                    ].map(opt => (
                                                        <Button
                                                            size="sm"
                                                            key={opt.label}
                                                            onClick={() => setAgentForm({
                                                                ...agentForm,
                                                                collaboration: {
                                                                    ...agentForm.collaboration!,
                                                                    schedule: opt.val
                                                                }
                                                            })}
                                                        >
                                                            {opt.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card>


                            <Card className="space-y-6">

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                    {selectedAgent.persona ? (
                                        <AgentFileButton
                                            title="PERSONA.md"
                                            description="Core personality"
                                            icon={faIdBadge}
                                            iconColorClass="bg-neutral-800/10"
                                            onClick={() => setViewingFile({ title: 'PERSONA.md', content: selectedAgent.persona!, isEditing: true, agentId: selectedAgent.id })}
                                        />
                                    ) : (
                                        <AgentFileButton
                                            title="IDENTITY.md"
                                            description="Core instructions"
                                            icon={faIdBadge}
                                            iconColorClass="bg-neutral-800/10"
                                            onClick={() => setViewingFile({ title: 'IDENTITY.md', content: selectedAgent.identity!, isEditing: true, agentId: selectedAgent.id })}
                                        />
                                    )}

                                    {!selectedAgent.persona && (
                                        <AgentFileButton
                                            title="SOUL.md"
                                            description="Moral values"
                                            icon={faMicrochip}
                                            iconColorClass="bg-teal-400/20"
                                            onClick={() => setViewingFile({ title: 'SOUL.md', content: selectedAgent.soul!, isEditing: true, agentId: selectedAgent.id })}
                                        />
                                    )}

                                    <AgentFileButton
                                        title="MEMORY.md"
                                        description="Stored facts"
                                        icon={faBrain}
                                        iconColorClass="bg-indigo-400/20"
                                        onClick={() => setViewingFile({ title: 'MEMORY.md', content: selectedAgent.memory || '', isEditing: true, agentId: selectedAgent.id })}
                                    />

                                    <AgentFileButton
                                        title="HEARTBEAT.md"
                                        description="Scheduled tasks"
                                        icon={faHeartPulse}
                                        iconColorClass="bg-red-400/20"
                                        onClick={() => setViewingFile({ title: 'HEARTBEAT.md', content: selectedAgent.heartbeatInstructions || '', isEditing: true, agentId: selectedAgent.id })}
                                    />

                                    <AgentFileButton
                                        title={selectedAgent.persona ? "RULES.md" : "AGENT.md"}
                                        description="Rules & Guardrails"
                                        icon={faShield}
                                        iconColorClass="bg-sky-400/20"
                                        onClick={() => setViewingFile({ title: selectedAgent.persona ? 'RULES.md' : 'AGENT.md', content: selectedAgent.rules || '', isEditing: true, agentId: selectedAgent.id })}
                                    />

                                </div>

                                <Button
                                    variant="danger"
                                    className="w-full mt-4"
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    icon={faTrash}
                                >
                                    Delete Agent
                                </Button>
                            </Card>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-bg-card rounded-3xl">
                            <Text secondary={true}>Select an agent from the left to view details</Text>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Agent Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setNewAgentName('')
                    setNewAgentPersona('Generic')
                    setError(null)
                }}
                title={
                    <div className="flex items-center gap-2">
                        <span>Create New Agent</span>
                    </div>
                }
                className="!max-w-md"
            >
                <div className="p-6 space-y-6">
                    <Text size="sm">
                        Enter a name for your new agent. Default configuration files will be created automatically.
                    </Text>

                    <Input
                        label="Agent Name"
                        currentText={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        clearText={() => setNewAgentName('')}
                        placeholder="e.g., Assistant, Helper, Guide"
                        icon={faUser}
                        inputClassName="!mt-0"
                    />

                    <Select
                        label="Personas"
                        value={newAgentPersona}
                        onChange={(e) => setNewAgentPersona(e.target.value)}
                        options={personas.map(p => ({ label: p, value: p }))}
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
                                setIsModalOpen(false)
                                setNewAgentName('')
                                setNewAgentPersona('Generic')
                                setError(null)
                            }}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            themed={true}
                            className="flex-1"
                            onClick={createAgent}
                            disabled={creating || !newAgentName.trim()}
                            icon={creating ? undefined : faPlus}
                        >
                            {creating ? (
                                <div className="flex items-center gap-2">
                                    {/* <RefreshCw size={16} className="animate-spin" /> */}
                                    Creating...
                                </div>
                            ) : (
                                'Create Agent'
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Trigger Heartbeat Confirmation Modal */}
            <Modal
                isOpen={isHeartbeatModalOpen}
                onClose={() => setIsHeartbeatModalOpen(false)}
                title="Run Scheduled Task"
                className="!max-w-md"
            >
                <div className="p-6 space-y-6 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 text-2xl">
                            <FontAwesomeIcon icon={faPlay} />
                        </div>
                        <div className="space-y-1">
                            <Text bold={true} size="lg">Run heartbeat now?</Text>
                            <Text secondary={true} size="sm">
                                This will immediately execute the scheduled task for <b>{selectedAgent?.name}</b> using its HEARTBEAT.md instructions.
                            </Text>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button
                            themed={false}
                            className="flex-1"
                            onClick={() => setIsHeartbeatModalOpen(false)}
                            disabled={triggeringHeartbeat}
                        >
                            Cancel
                        </Button>
                        <Button
                            themed={true}
                            className="flex-1"
                            onClick={handleTriggerHeartbeat}
                            disabled={triggeringHeartbeat}
                            icon={triggeringHeartbeat ? undefined : faPlay}
                        >
                            {triggeringHeartbeat ? 'Triggering...' : 'Run Now'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Agent Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false)
                    setError(null)
                }}
                title="Delete Agent"
                className="!max-w-md"
            >
                <div className="p-6 space-y-6 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 text-2xl">
                            <FontAwesomeIcon icon={faTrash} />
                        </div>
                        <div className="space-y-1">
                            <Text bold={true} size="lg">Are you sure?</Text>
                            <Text secondary={true} size="sm">
                                This will permanently delete <b>{selectedAgent?.name}</b> and all of its associated files, including identity, soul, and memory.
                            </Text>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-left">
                            <p className="text-sm text-rose-500">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <Button
                            themed={false}
                            className="flex-1"
                            onClick={() => {
                                setIsDeleteModalOpen(false)
                                setError(null)
                            }}
                            disabled={deletingAgent}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            onClick={handleDeleteAgent}
                            disabled={deletingAgent}
                            icon={deletingAgent ? undefined : faTrash}
                        >
                            {deletingAgent ? 'Deleting...' : 'Confirm Delete'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </Page>
    )
}
