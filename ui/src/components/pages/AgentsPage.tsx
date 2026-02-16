import { useState, useEffect } from 'react'
import { faRobot, faPlus, faUser, faSmile, faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BrainCircuit, RefreshCw, FileText, History } from 'lucide-react'
import Button from '../Button'
import Card from '../Card'
import IconBox from '../IconBox'
import Text from '../Text'
import Modal from '../Modal'
import Input from '../Input'
import Page from './Page'

interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    memory?: string;
    systemPrompt: string;
    provider?: string;
}

interface AgentsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    setViewingFile: (file: { title: string, content: string, isEditing: boolean, agentId: string } | null) => void;
    agentForm: { name: string; emoji: string; provider?: string };
    setAgentForm: React.Dispatch<React.SetStateAction<{ name: string; emoji: string; provider?: string }>>;
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
    fetchAgents: fetchAgentsFromParent,
    selectedAgentId: selectedAgentIdFromParent,
    setSelectedAgentId: setSelectedAgentIdFromParent,
    providers
}: AgentsPageProps) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
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
            setAgentForm({ name: selectedAgent.name, emoji: selectedAgent.emoji, provider: selectedAgent.provider || '' })
        }
    }, [selectedAgent, setAgentForm])

    const fetchAgents = async () => {
        try {
            setLoading(true)
            const response = await fetch(`${gatewayAddr}/api/agents`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            })
            if (!response.ok) throw new Error('Failed to fetch agents')
            const data = await response.json()
            setAgents(data)
            if (data.length > 0 && !selectedAgentId) {
                setSelectedAgentId(data[0].id)
            }
            // Also update parent's agents state
            await fetchAgentsFromParent()
        } catch (error) {
            console.error('Failed to fetch agents:', error)
        } finally {
            setLoading(false)
        }
    }

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
            setAgents([...agents, newAgent])
            setSelectedAgentId(newAgent.id)
            setIsModalOpen(false)
            setNewAgentName('')
            // Also update parent's agents state
            await fetchAgentsFromParent()
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
                <RefreshCw className="animate-spin text-accent-primary mb-4" size={40} />
                <p className="font-medium">Loading agents...</p>
            </div>
        )
    }

    return (
        <Page
            title="Agents"
            subtitle="Manage your AI agent personalities and configurations."
            headerAction={
                <Button
                    themed={true}
                    className="h-10 px-4 py-2 text-white"
                    onClick={() => setIsModalOpen(true)}
                    icon={faPlus}
                >
                    Add Agent
                </Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl">
                {/* Left Column - Discovered Agents */}
                <div className="lg:col-span-4 space-y-4">
                    <Card padding="p-4" className="space-y-1 h-min max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="px-4 py-2 mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase">Discovered Agents</h3>
                            <button
                                onClick={fetchAgents}
                                className="p-2 hover:bg-white-trans rounded-lg transition-all group"
                                title="Refresh Agents"
                            >
                                <RefreshCw size={14} className="group-active:rotate-180 transition-transform duration-500" />
                            </button>
                        </div>
                        {agents.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm italic opacity-60">No agents discovered yet</p>
                            </div>
                        ) : (
                            agents.map(a => (
                                <Button
                                    key={a.id}
                                    themed={selectedAgentId === a.id}
                                    className={`w-full flex items-center gap-3 !px-4 !py-3 ${selectedAgentId !== a.id ? '!bg-transparent hover:!bg-white/5' : ''}`}
                                    onClick={() => setSelectedAgentId(a.id)}
                                >
                                    <span className="text-xl mr-1">{a.emoji}</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-sm">{a.name}</div>
                                        <div className="text-xs opacity-60 font-normal">{a.provider || 'Global Default'}</div>
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
                                <IconBox icon={<BrainCircuit size={20} />} />
                                <Text bold={true} size="xl">{selectedAgent.name}</Text>
                                <span className="text-3xl ml-2">{selectedAgent.emoji}</span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">Personalization</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <Input
                                            label="Agent Nickname"
                                            currentText={agentForm.name}
                                            onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                            icon={faUser}
                                            className="md:col-span-2"
                                            inputClassName="!mt-0"
                                        />
                                        <Input
                                            label="Emoji Icon"
                                            currentText={agentForm.emoji}
                                            onChange={e => setAgentForm({ ...agentForm, emoji: e.target.value })}
                                            icon={faSmile}
                                            inputClassName="!mt-0 font-emoji text-center pl-0"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-xs font-bold uppercase tracking-wider mb-2 block opacity-60">Model</label>
                                        <select
                                            className="w-full bg-bg-primary border border-border-color rounded-xl px-4 py-3 outline-none focus:border-accent-primary transition-all text-sm appearance-none"
                                            value={agentForm.provider || ''}
                                            onChange={(e) => setAgentForm({ ...agentForm, provider: e.target.value })}
                                        >
                                            <option value="">Use Global Default</option>
                                            {providers.map((p, idx) => (
                                                <option key={idx} value={p.description}>{p.description}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button
                                        themed={true}
                                        className="w-full h-12 text-white"
                                        onClick={saveAgentConfig}
                                        icon={faSave}
                                    >
                                        Update Agent Meta Profile
                                    </Button>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-60">Agent ID</h4>
                                    <p className="text-sm font-mono bg-bg-primary border border-border-color rounded-lg px-4 py-2">{selectedAgent.id}</p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-60">Path</h4>
                                    <p className="text-sm font-mono bg-bg-primary border border-border-color rounded-lg px-4 py-2 break-all">{selectedAgent.path}</p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">Agent Files</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card
                                            padding="p-5"
                                            className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                            onClick={() => setViewingFile({ title: 'IDENTITY.md', content: selectedAgent.identity, isEditing: true, agentId: selectedAgent.id })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold uppercase text-xs tracking-tight">IDENTITY.md</div>
                                                    <div className="text-xs">Core instructions</div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card
                                            padding="p-5"
                                            className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                            onClick={() => setViewingFile({ title: 'SOUL.md', content: selectedAgent.soul, isEditing: true, agentId: selectedAgent.id })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-all">
                                                    <BrainCircuit size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold uppercase text-xs tracking-tight">SOUL.md</div>
                                                    <div className="text-xs">Moral values</div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card
                                            padding="p-5"
                                            className="group flex justify-between items-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all cursor-pointer"
                                            onClick={() => setViewingFile({ title: 'MEMORY.md', content: selectedAgent.memory || '', isEditing: true, agentId: selectedAgent.id })}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all">
                                                    <History size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold uppercase text-xs tracking-tight">MEMORY.md</div>
                                                    <div className="text-xs">Stored facts</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-bg-card rounded-3xl border border-dashed border-border-color">
                            <BrainCircuit size={40} className="text-border-color mb-4" />
                            <p className="font-medium italic">Select an agent from the left to view details</p>
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
                            className="flex-1 h-12"
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
                            className="flex-1 h-12 text-white"
                            onClick={createAgent}
                            disabled={creating || !newAgentName.trim()}
                            icon={creating ? undefined : faPlus}
                        >
                            {creating ? (
                                <div className="flex items-center gap-2">
                                    <RefreshCw size={16} className="animate-spin" />
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
