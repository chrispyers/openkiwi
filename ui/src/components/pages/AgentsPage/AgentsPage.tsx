import { useState, useEffect } from 'react'
import { faPlus, faUser, faSave, faClock, faBrain, faMicrochip, faHeartPulse, faTrash, faIdBadge, faShield, faClockFour, faUsers, faPlay, faStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../../Button'
import Card from '../../Card'
import Text from '../../Text'
import Modal from '../../Modal'
import Input from '../../Input'
import Toggle from '../../Toggle'
import Page from '../Page'
import Select from '../../Select'
import AgentFileButton from '../../AgentFileButton'
import Code from '../../Code'
import { toast } from 'sonner'
import { Agent, AgentState } from '../../../types'
import Row from '../../Row'
import Column from '../../Column'
import ErrorMessage from '../../ErrorMessage'
import SectionHeader from '../../SectionHeader'
import AgentButton from './AgentButton'
import AvatarModal from './AvatarModal'
import SetAgentAvatarButton from './SetAgentAvatarButton'

interface AgentsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    agentForm: { name: string; avatar?: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; allowManualTrigger?: boolean; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; avatar?: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; allowManualTrigger?: boolean; } }>>
    saveAgentConfig: (formOverride?: any, successMessage?: string, successDescription?: string) => Promise<void>;
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
    agents: Agent[];
    allowManualHeartbeat: boolean;
    agentStates: Record<string, AgentState>;
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
    allowManualHeartbeat,
    agentStates
}: AgentsPageProps) {
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
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)

    // Use selectedAgentId from props
    const selectedAgentId = selectedAgentIdFromParent
    const setSelectedAgentId = setSelectedAgentIdFromParent

    const selectedAgent = agents.find(a => a.id === selectedAgentId)

    // Update agentForm when selected agent changes
    useEffect(() => {
        if (selectedAgent) {
            setAgentForm({
                name: selectedAgent.name,
                avatar: selectedAgent.avatar,
                provider: selectedAgent.provider || '',
                heartbeat: selectedAgent.heartbeat || { enabled: false, schedule: '* * * * *', allowManualTrigger: false }
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
                {/* Left Column - Discovered Agents */}
                <div className="lg:col-span-4 space-y-4">
                    <Card padding={4}>
                        {agents.length === 0 ? (
                            <div className="p-6 text-center">
                                <Text secondary={true}>No agents discovered yet</Text>
                            </div>
                        ) : (

                            agents.map(a => (
                                <AgentButton
                                    key={a.id}
                                    agent={a}
                                    isSelected={selectedAgentId === a.id}
                                    onClick={() => setSelectedAgentId(a.id)}
                                    provider={providers.find(p => p.description === a.provider)}
                                />
                            ))
                        )}
                    </Card>


                </div>

                {/* Right Column - Agent Details */}
                <div className="lg:col-span-8">
                    {selectedAgent ? (
                        <Page padding={0}>
                            {/* AGENT DETAILS */}

                            <Card>
                                <Row align="end" gap="gap-4">
                                    <Column>
                                        <SetAgentAvatarButton
                                            onClick={() => setIsAvatarModalOpen(true)}
                                            avatar={agentForm.avatar}
                                            agentId={selectedAgent?.id}
                                            agentName={agentForm.name}
                                            gatewayAddr={gatewayAddr}
                                            gatewayToken={gatewayToken}
                                        />
                                    </Column>
                                    <Column grow={true}>
                                        <Input
                                            label="Agent Name"
                                            currentText={agentForm.name}
                                            onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                            clearText={() => setAgentForm({ ...agentForm, name: '' })}
                                            icon={faUser}
                                        />
                                    </Column>
                                    <Column>
                                        <Button
                                            themed={true}
                                            disabled={agentForm.name === selectedAgent?.name || !agentForm.name.trim()}
                                            onClick={() => saveAgentConfig(agentForm)}
                                            icon={faSave}
                                        >
                                            Save
                                        </Button>
                                    </Column>
                                </Row>

                                <Row>
                                    <Select
                                        label="Model"
                                        value={agentForm.provider || ''}
                                        onChange={(e) => {
                                            const newProvider = e.target.value;
                                            const updated = { ...agentForm, provider: newProvider };
                                            setAgentForm(updated);
                                            saveAgentConfig(updated);
                                        }}
                                        options={[
                                            { value: '', label: 'Use Global Default' },
                                            ...providers.map(p => ({
                                                value: p.description,
                                                label: p.description
                                            }))
                                        ]}
                                    />
                                </Row>

                            </Card>

                            {/* SCHEDULED TASKS */}
                            <Card>
                                <Row>
                                    <Column grow={true}>
                                        <SectionHeader title="Scheduled Tasks" icon={faClockFour} />
                                        <Text size="sm" secondary={true}>Allows the agent to perform automated tasks on a schedule</Text>
                                    </Column>
                                    <Column>
                                        <Toggle
                                            checked={agentForm.heartbeat?.enabled || false}
                                            onChange={() => {
                                                const newEnabled = !(agentForm.heartbeat?.enabled);
                                                const updated = {
                                                    ...agentForm,
                                                    heartbeat: {
                                                        schedule: agentForm.heartbeat?.schedule || '* * * * *',
                                                        enabled: newEnabled
                                                    }
                                                };
                                                setAgentForm(updated);
                                                saveAgentConfig(
                                                    updated,
                                                    newEnabled ? 'Scheduled tasks enabled' : 'Scheduled tasks disabled',
                                                    newEnabled ? 'The agent will now perform tasks on your defined schedule.' : 'Automated processing has been paused.'
                                                );
                                            }}
                                        />
                                    </Column>
                                </Row>

                                {(agentForm.heartbeat?.enabled) && (
                                    <>

                                        <Row align="end" gap="gap-4">
                                            <Column grow={true}>
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
                                            </Column>
                                            <Column>
                                                <Button
                                                    themed={true}
                                                    disabled={agentForm.heartbeat?.schedule === selectedAgent?.heartbeat?.schedule}
                                                    onClick={() => saveAgentConfig(agentForm)}
                                                    icon={faSave}
                                                >
                                                    Save
                                                </Button>
                                            </Column>
                                        </Row>
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

                                        {(allowManualHeartbeat || selectedAgent?.heartbeat?.allowManualTrigger) && (() => {
                                            const agentState = selectedAgentId ? agentStates[selectedAgentId] : undefined
                                            const isRunning = agentState?.status === 'working'
                                            return (
                                                <Button
                                                    themed={true}
                                                    className={`w-full ${isRunning
                                                        ? '!bg-amber-500/10 !text-amber-600 dark:!text-amber-400'
                                                        : '!bg-emerald-500/10 hover:!bg-emerald-500/20 dark:!bg-emerald-500/10 dark:hover:!bg-emerald-500/20 !text-emerald-600 dark:!text-emerald-400'
                                                        } mt-4`}
                                                    onClick={() => setIsHeartbeatModalOpen(true)}
                                                    icon={faPlay}
                                                    disabled={isRunning}
                                                >
                                                    {isRunning ? 'Running...' : 'Run Now'}
                                                </Button>
                                            )
                                        })()}
                                    </>
                                )}

                            </Card>

                            {/* FILES */}
                            <Card gridCols={2}>

                                {selectedAgent.persona ? (
                                    <AgentFileButton
                                        title="PERSONA.md"
                                        description="Core personality"
                                        icon={faIdBadge}
                                        iconColorClass="bg-neutral-800/10"
                                        onClick={() => setViewingFile({ title: 'PERSONA.md', content: selectedAgent.persona!, isEditing: false, agentId: selectedAgent.id })}
                                    />
                                ) : (
                                    <AgentFileButton
                                        title="IDENTITY.md"
                                        description="Core instructions"
                                        icon={faIdBadge}
                                        iconColorClass="bg-neutral-800/10"
                                        onClick={() => setViewingFile({ title: 'IDENTITY.md', content: selectedAgent.identity!, isEditing: false, agentId: selectedAgent.id })}
                                    />
                                )}

                                {!selectedAgent.persona && (
                                    <AgentFileButton
                                        title="SOUL.md"
                                        description="Moral values"
                                        icon={faMicrochip}
                                        iconColorClass="bg-teal-400/20"
                                        onClick={() => setViewingFile({ title: 'SOUL.md', content: selectedAgent.soul!, isEditing: false, agentId: selectedAgent.id })}
                                    />
                                )}

                                <AgentFileButton
                                    title="MEMORY.md"
                                    description="Stored facts"
                                    icon={faBrain}
                                    iconColorClass="bg-indigo-400/20"
                                    onClick={() => setViewingFile({ title: 'MEMORY.md', content: selectedAgent.memory || '', isEditing: false, agentId: selectedAgent.id })}
                                />

                                <AgentFileButton
                                    title="HEARTBEAT.md"
                                    description="Scheduled tasks"
                                    icon={faHeartPulse}
                                    iconColorClass="bg-red-400/20"
                                    onClick={() => setViewingFile({ title: 'HEARTBEAT.md', content: selectedAgent.heartbeatInstructions || '', isEditing: false, agentId: selectedAgent.id })}
                                />

                                <AgentFileButton
                                    title={selectedAgent.persona ? "RULES.md" : "AGENT.md"}
                                    description="Rules & Guardrails"
                                    icon={faShield}
                                    iconColorClass="bg-sky-400/20"
                                    onClick={() => setViewingFile({ title: selectedAgent.persona ? 'RULES.md' : 'AGENT.md', content: selectedAgent.rules || '', isEditing: false, agentId: selectedAgent.id })}
                                />


                            </Card>

                            <Button
                                themed={false}
                                icon={faStar}
                                onClick={() => {
                                    const updated = { ...agentForm, isDefault: true }
                                    setAgentForm(updated)
                                    saveAgentConfig(updated)
                                }}
                                disabled={selectedAgent.isDefault}
                            >
                                Set Default Assistant
                            </Button>

                            <Button
                                variant="danger"
                                onClick={() => setIsDeleteModalOpen(true)}
                                icon={faTrash}
                            >
                                Delete Agent
                            </Button>

                        </Page>
                    ) : (
                        <Card className="flex-1 flex flex-col items-center justify-center py-20">
                            <Text secondary={true}>Select an agent from the left to view details</Text>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create Agent Modal */}
            <Modal
                title="Create New Agent"
                className="!max-w-md"
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setNewAgentName('')
                    setNewAgentPersona('Generic')
                    setError(null)
                }}>
                <Page>
                    <Text>Enter a name for your new agent and select a persona. Configuration files will be created automatically.</Text>

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

                    <ErrorMessage error={error} />

                    <Row>
                        {/* CANCEL */}
                        <Column grow={true}>
                            <Button
                                className="w-full"
                                themed={false}
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setNewAgentName('')
                                    setNewAgentPersona('Generic')
                                    setError(null)
                                }}
                                disabled={creating}>Cancel</Button>
                        </Column>
                        {/* CREATE */}
                        <Column grow={true}>
                            <Button
                                themed={true}
                                className="w-full"
                                onClick={createAgent}
                                disabled={creating || !newAgentName.trim()}
                                icon={creating ? undefined : faPlus}
                            >
                                {creating ? 'Creating Agent...' : 'Create Agent'}
                            </Button>
                        </Column>
                    </Row>
                </Page>
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

                    <ErrorMessage error={error} className="text-left" />

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

            {/* Avatar Modal */}
            <AvatarModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                onSave={async (dataUrl: string) => {
                    if (!selectedAgent?.id) return;
                    try {
                        const response = await fetch(`${gatewayAddr}/api/agents/${selectedAgent.id}/avatar`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${gatewayToken}`
                            },
                            body: JSON.stringify({ image: dataUrl })
                        });
                        if (response.ok) {
                            const data = await response.json();
                            const updated = { ...agentForm, avatar: data.avatar };
                            setAgentForm(updated);
                            await fetchAgents();
                            toast.success('Avatar updated', { description: 'The agent avatar has been successfully changed.' });
                        } else {
                            throw new Error('Failed to upload avatar');
                        }
                    } catch (e) {
                        toast.error('Failed to save avatar');
                    }
                }}
            />
        </Page >
    )
}
