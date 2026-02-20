import { useState, useEffect } from 'react'
import { faRobot, faPlus, faUser, faSmile, faSave, faClock, faFileText, faBrain, faMicrochip } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../Button'
import Card from '../Card'
import Text from '../Text'
import Modal from '../Modal'
import Input from '../Input'
import Toggle from '../Toggle'
import Page from './Page'
import Select from '../Select'

interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    memory?: string;
    heartbeatInstructions?: string;
    heartbeat?: {
        enabled: boolean;
        schedule: string;
    };
    systemPrompt: string;
    provider?: string;
}

interface AgentsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    agentForm: { name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; } };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string; heartbeat?: { enabled: boolean; schedule: string; } }>>;
    saveAgentConfig: () => Promise<void>;
    fetchAgents: () => Promise<void>;
    selectedAgentId: string;
    setSelectedAgentId: (id: string) => void;
    providers: { description: string; endpoint: string; model: string }[];
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
    agents
}: AgentsPageProps & { agents: Agent[] }) {
    // Remove local agents state
    // const [agents, setAgents] = useState<Agent[]>([])
    // Remove local loading state as we rely on parent's data or we can keep it if we want to show loading while fetching
    const [loading, setLoading] = useState(false) // Default to false as data typically passed from parent
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newAgentName, setNewAgentName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
                heartbeat: selectedAgent.heartbeat || { enabled: false, schedule: '* * * * *' }
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
                body: JSON.stringify({ name: newAgentName.trim() })
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
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to create agent')
        } finally {
            setCreating(false)
        }
    }

    useEffect(() => {
        fetchAgents()
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
                            agents.map(a => (
                                <Button
                                    size="md"
                                    key={a.id}
                                    themed={selectedAgentId === a.id}
                                    className={`w-full !justify-start gap-3 !px-4 !py-3 ${selectedAgentId !== a.id ? '!bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800' : ''}`}
                                    onClick={() => setSelectedAgentId(a.id)}
                                >
                                    <div className="text-left">
                                        <div><Text bold={true}>{a.name}</Text></div>
                                        <div><Text secondary={true} size="sm">{a.provider || 'Global Default'}</Text></div>
                                    </div>
                                </Button>
                            ))
                        )}
                    </Card>


                </div>

                {/* Right Column - Agent Details */}
                <div className="lg:col-span-8">
                    {selectedAgent ? (
                        <Card className="space-y-6">
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
                                    <div className="mb-4 bg-bg-primary/50 border border-border-color rounded-xl p-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <Text bold={true}><FontAwesomeIcon icon={faRobot} /> Proactive Heartbeat</Text>
                                                <div className="mb-2">
                                                    <Text size="sm" secondary={true}>Allows the agent to wake up on a schedule</Text>
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
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                                <div className="flex gap-2">
                                                    {[
                                                        { label: 'Every 10m', val: '*/10 * * * *' },
                                                        { label: 'Hourly', val: '0 * * * *' },
                                                        { label: 'Daily', val: '0 0 * * *' }
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

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card
                                        padding="p-1"
                                        className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                        onClick={() => setViewingFile({ title: 'IDENTITY.md', content: selectedAgent.identity, isEditing: true, agentId: selectedAgent.id })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                <Text size="2xl"><FontAwesomeIcon icon={faFileText} /></Text>
                                            </div>
                                            <div>
                                                <div className="text-xs"><Text size="xs" bold={true}>IDENTITY.md</Text></div>
                                                <div className="text-xs"><Text size="xs" secondary={true}>Core instructions</Text></div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card
                                        padding="p-1"
                                        className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                        onClick={() => setViewingFile({ title: 'SOUL.md', content: selectedAgent.soul, isEditing: true, agentId: selectedAgent.id })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-all">
                                                <Text size="2xl"><FontAwesomeIcon icon={faMicrochip} /></Text>
                                            </div>
                                            <div>
                                                <div className="text-xs"><Text size="xs" bold={true}>SOUL.md</Text></div>
                                                <div className="text-xs"><Text size="xs" secondary={true}>Moral values</Text></div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card
                                        padding="p-1"
                                        className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                        onClick={() => setViewingFile({ title: 'MEMORY.md', content: selectedAgent.memory || '', isEditing: true, agentId: selectedAgent.id })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all">
                                                <Text size="2xl"><FontAwesomeIcon icon={faBrain} /></Text>
                                            </div>
                                            <div>
                                                <div className="text-xs"><Text size="xs" bold={true}>MEMORY.md</Text></div>
                                                <div className="text-xs"><Text size="xs" secondary={true}>Stored facts</Text></div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card
                                        padding="p-1"
                                        className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                        onClick={() => setViewingFile({ title: 'HEARTBEAT.md', content: selectedAgent.heartbeatInstructions || '', isEditing: true, agentId: selectedAgent.id })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-rose-400 group-hover:bg-rose-400/10 transition-all">
                                                <Text size="2xl"><FontAwesomeIcon icon={faRobot} /></Text>
                                            </div>
                                            <div>
                                                <div className="text-xs"><Text size="xs" bold={true}>HEARTBEAT.md</Text></div>
                                                <div className="text-xs"><Text size="xs" secondary={true}>Scheduled tasks</Text></div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </Card>
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
                    setError(null)
                }}
                title={
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faRobot} />
                        <span>Create New Agent</span>
                    </div>
                }
                className="!max-w-md"
            >
                <div className="p-6 space-y-6">
                    <p className="text-sm">
                        Enter a name for your new agent. Default configuration files will be created automatically.
                    </p>

                    <Input
                        label="Agent Name"
                        currentText={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        clearText={() => setNewAgentName('')}
                        placeholder="e.g., Assistant, Helper, Guide"
                        icon={faRobot}
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
                                setIsModalOpen(false)
                                setNewAgentName('')
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
        </Page>
    )
}
