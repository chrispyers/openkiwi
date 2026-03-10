import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Text from '../Text'
import Button from '../Button'
import Input from '../Input'
import TextArea from '../TextArea'
import Modal from '../Modal'
import { Workflow, WorkflowState } from '../../types'
import Column from '../Column'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faPlus, faTrash, faSave, faEnvelope, faListCheck, faCalendar,
    faCode, faGlobe, faMagnifyingGlass, faTerminal, faFolder,
    faRobot, faDatabase, faCloud, faEye, faChevronRight, faXmark,
    faBolt, faWrench, faArrowRight
} from '@fortawesome/free-solid-svg-icons'

interface ToolDef {
    id: string;
    name: string;
    category: string;
    icon: any;
    color: string;
    description: string;
}

const TOOLS: ToolDef[] = [
    { id: 'google_gmail', name: 'Gmail', category: 'Google', icon: faEnvelope, color: '#EA4335', description: 'Read, search, and send emails' },
    { id: 'google_tasks', name: 'Tasks', category: 'Google', icon: faListCheck, color: '#4285F4', description: 'Manage Google Tasks lists' },
    { id: 'google_calendar', name: 'Calendar', category: 'Google', icon: faCalendar, color: '#34A853', description: 'Manage calendar events' },
    { id: 'github', name: 'GitHub', category: 'Dev', icon: faCode, color: '#6e40c9', description: 'Interact with GitHub repos' },
    { id: 'web_browser', name: 'Browser', category: 'Web', icon: faGlobe, color: '#4A90D9', description: 'Browse and interact with websites' },
    { id: 'web_search', name: 'Web Search', category: 'Web', icon: faMagnifyingGlass, color: '#F5A623', description: 'Search the web' },
    { id: 'web_fetch', name: 'Web Fetch', category: 'Web', icon: faCloud, color: '#7B68EE', description: 'Fetch content from a URL' },
    { id: 'bash', name: 'Bash', category: 'System', icon: faTerminal, color: '#2D2D2D', description: 'Execute shell commands' },
    { id: 'filesystem', name: 'Filesystem', category: 'System', icon: faFolder, color: '#E8A020', description: 'Read and write files' },
    { id: 'vision', name: 'Vision', category: 'AI', icon: faEye, color: '#9B59B6', description: 'Analyze images with AI' },
    { id: 'agent', name: 'Agent', category: 'AI', icon: faRobot, color: '#1ABC9C', description: 'Delegate to an AI agent' },
    { id: 'qdrant', name: 'Qdrant', category: 'Data', icon: faDatabase, color: '#DC3545', description: 'Vector database operations' },
    { id: 'weather', name: 'Weather', category: 'Data', icon: faCloud, color: '#3498DB', description: 'Fetch weather data' },
]

const TOOL_CATEGORIES = ['Google', 'Web', 'AI', 'Dev', 'System', 'Data']

function getToolDef(id: string): ToolDef {
    return TOOLS.find(t => t.id === id) ?? {
        id,
        name: id,
        category: 'Other',
        icon: faWrench,
        color: '#888888',
        description: ''
    }
}

interface WorkflowNode {
    id: string;
    tool_id: string;
    label: string;
    prompt: string;
    order_index: number;
}

function stateToNode(s: WorkflowState): WorkflowNode {
    let tool_id = 'web_fetch'
    let prompt = s.instructions ?? ''
    try {
        const parsed = JSON.parse(s.instructions ?? '')
        if (parsed.tool_id) tool_id = parsed.tool_id
        if (parsed.prompt !== undefined) prompt = parsed.prompt
    } catch {
        // instructions is plain text, treat as prompt
    }
    return { id: s.id, tool_id, label: s.name, prompt, order_index: s.order_index }
}

function nodeToStatePayload(node: WorkflowNode) {
    return {
        name: node.label,
        order_index: node.order_index,
        assigned_agent_id: null,
        instructions: JSON.stringify({ tool_id: node.tool_id, prompt: node.prompt })
    }
}

interface WorkflowBuilderProps {
    workflow: Workflow;
    gatewayAddr: string;
    gatewayToken: string;
}

// ── Tool Picker Modal ──────────────────────────────────────────────────────────
function ToolPickerModal({ onSelect, onClose }: { onSelect: (tool: ToolDef) => void; onClose: () => void }) {
    return (
        <Modal isOpen={true} onClose={onClose} title="Add a Node" className="max-w-[560px]">
            <div className="p-6 space-y-5">
                {TOOL_CATEGORIES.map(category => {
                    const tools = TOOLS.filter(t => t.category === category)
                    if (!tools.length) return null
                    return (
                        <div key={category}>
                            <Text size="sm" secondary={true} bold={true} className="uppercase tracking-wider mb-3">{category}</Text>
                            <div className="grid grid-cols-3 gap-2">
                                {tools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => onSelect(tool)}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-divider hover:border-accent-primary hover:bg-accent-primary/5 transition-all text-left group"
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: tool.color + '22', color: tool.color }}
                                        >
                                            <FontAwesomeIcon icon={tool.icon} className="text-sm" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-primary truncate">{tool.name}</div>
                                            <div className="text-xs text-secondary truncate">{tool.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </Modal>
    )
}

// ── Node Card ──────────────────────────────────────────────────────────────────
function NodeCard({
    node,
    index,
    isSelected,
    isOnly,
    onSelect,
    onDelete,
}: {
    node: WorkflowNode;
    index: number;
    isSelected: boolean;
    isOnly: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) {
    const tool = getToolDef(node.tool_id)

    return (
        <div className="flex items-center">
            <div
                onClick={onSelect}
                className={`relative w-44 rounded-2xl border-2 cursor-pointer transition-all duration-150 group overflow-hidden
                    ${isSelected
                        ? 'border-accent-primary shadow-lg shadow-accent-primary/20'
                        : 'border-divider hover:border-neutral-400 dark:hover:border-neutral-500'
                    }
                    bg-card`}
            >
                {/* Color accent top bar */}
                <div className="h-1 w-full" style={{ backgroundColor: tool.color }} />

                <div className="p-4">
                    {/* Step number + delete */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-secondary uppercase tracking-wider">Step {index + 1}</span>
                        {!isOnly && (
                            <button
                                onClick={e => { e.stopPropagation(); onDelete() }}
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                            >
                                <FontAwesomeIcon icon={faXmark} className="text-xs" />
                            </button>
                        )}
                    </div>

                    {/* Tool icon + name */}
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: tool.color + '22', color: tool.color }}
                        >
                            <FontAwesomeIcon icon={tool.icon} className="text-sm" />
                        </div>
                        <span className="text-xs font-semibold text-secondary">{tool.name}</span>
                    </div>

                    {/* Label */}
                    <div className="text-sm font-semibold text-primary leading-tight line-clamp-2 min-h-[2.5rem]">
                        {node.label || <span className="text-secondary italic">Unnamed</span>}
                    </div>
                </div>
            </div>

            {/* Arrow connector */}
            <div className="flex-shrink-0 w-8 flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
            </div>
        </div>
    )
}

// ── Config Panel ───────────────────────────────────────────────────────────────
function ConfigPanel({
    node,
    onChange,
    onChangeTool,
}: {
    node: WorkflowNode;
    onChange: (field: 'label' | 'prompt', value: string) => void;
    onChangeTool: () => void;
}) {
    const tool = getToolDef(node.tool_id)

    return (
        <div className="border-t border-divider bg-neutral-50 dark:bg-neutral-900/50 p-5">
            <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3 mb-1">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: tool.color + '22', color: tool.color }}
                    >
                        <FontAwesomeIcon icon={tool.icon} className="text-sm" />
                    </div>
                    <Text bold={true}>Configure: {tool.name}</Text>
                    <button
                        onClick={onChangeTool}
                        className="ml-auto text-xs text-accent-primary hover:underline"
                    >
                        Change tool
                    </button>
                </div>

                <Input
                    label="Label"
                    currentText={node.label}
                    onChange={e => onChange('label', e.target.value)}
                    placeholder="e.g. Fetch unread emails"
                />

                <TextArea
                    label="Instructions"
                    currentText={node.prompt}
                    onChange={e => onChange('prompt', e.target.value)}
                    placeholder={`What should this ${tool.name} step do? Describe the action, parameters, and what output to pass along.`}
                    rows={4}
                />
            </div>
        </div>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function WorkflowBuilder({ workflow, gatewayAddr, gatewayToken }: WorkflowBuilderProps) {
    const [nodes, setNodes] = useState<WorkflowNode[]>([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showToolPicker, setShowToolPicker] = useState(false)
    const [addingAfterIndex, setAddingAfterIndex] = useState<number | null>(null)
    const canvasRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchStates = async () => {
            setLoading(true)
            try {
                const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                })
                if (res.ok) {
                    const data: WorkflowState[] = await res.json()
                    const sorted = data.sort((a, b) => a.order_index - b.order_index)
                    setNodes(sorted.map(stateToNode))
                } else {
                    toast.error('Failed to load workflow')
                }
            } catch (e) {
                console.error(e)
                toast.error('Error loading workflow')
            } finally {
                setLoading(false)
            }
        }
        fetchStates()
    }, [workflow.id, gatewayAddr, gatewayToken])

    const selectedNode = nodes.find(n => n.id === selectedId) ?? null

    const handleAddNode = (afterIndex: number | null) => {
        setAddingAfterIndex(afterIndex)
        setShowToolPicker(true)
    }

    const handleToolSelected = (tool: ToolDef) => {
        setShowToolPicker(false)
        const newNode: WorkflowNode = {
            id: `temp-${Date.now()}`,
            tool_id: tool.id,
            label: tool.name,
            prompt: '',
            order_index: 0,
        }
        setNodes(prev => {
            const next = [...prev]
            const insertAt = addingAfterIndex === null ? 0 : addingAfterIndex + 1
            next.splice(insertAt, 0, newNode)
            return next.map((n, i) => ({ ...n, order_index: i }))
        })
        setSelectedId(newNode.id)
        setAddingAfterIndex(null)
        // Scroll canvas right
        setTimeout(() => {
            canvasRef.current?.scrollTo({ left: canvasRef.current.scrollWidth, behavior: 'smooth' })
        }, 50)
    }

    const handleChangeNode = (field: 'label' | 'prompt', value: string) => {
        setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, [field]: value } : n))
    }

    const handleChangeTool = () => {
        setAddingAfterIndex(null)
        setShowToolPicker(true)
    }

    const handleToolChangeSelected = (tool: ToolDef) => {
        setShowToolPicker(false)
        setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, tool_id: tool.id } : n))
    }

    const handleDelete = (id: string) => {
        setNodes(prev => {
            const next = prev.filter(n => n.id !== id).map((n, i) => ({ ...n, order_index: i }))
            return next
        })
        if (selectedId === id) setSelectedId(null)
    }

    const handleSave = async () => {
        if (nodes.length === 0) {
            toast.error('Add at least one node before saving')
            return
        }
        setIsSaving(true)
        try {
            for (const node of nodes) {
                const isNew = node.id.startsWith('temp-')
                const method = isNew ? 'POST' : 'PUT'
                const url = isNew
                    ? `${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`
                    : `${gatewayAddr.replace(/\/$/, '')}/api/collaboration/states/${node.id}`

                const res = await fetch(url, {
                    method,
                    headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(nodeToStatePayload(node))
                })
                if (!res.ok) throw new Error(`Failed to save node: ${node.label}`)
            }

            // Refetch to get real IDs
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            })
            if (res.ok) {
                const data: WorkflowState[] = await res.json()
                setNodes(data.sort((a, b) => a.order_index - b.order_index).map(stateToNode))
            }
            toast.success('Workflow saved')
        } catch (e) {
            console.error(e)
            toast.error('Error saving workflow')
        } finally {
            setIsSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-20">
                <Text secondary={true}>Loading workflow...</Text>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-xl border border-divider overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-divider bg-neutral-50 dark:bg-black/20 flex-shrink-0">
                <div>
                    <Text bold={true}>{workflow.name}</Text>
                    <Column>
                        <Text size="sm" secondary={true}>
                            {nodes.length === 0 ? 'Add nodes to build your workflow' : `${nodes.length} node${nodes.length === 1 ? '' : 's'}`}
                        </Text>
                    </Column>
                </div>
                <Button themed={true} icon={faSave} onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save'}
                </Button>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className="flex-1 overflow-x-auto overflow-y-hidden bg-neutral-50 dark:bg-neutral-950 relative"
                style={{
                    backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            >
                <div className="flex items-center h-full px-8 py-8 min-w-max gap-0">
                    {nodes.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 text-center px-20">
                            <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-2">
                                <FontAwesomeIcon icon={faBolt} className="text-2xl" />
                            </div>
                            <Text bold={true} size="lg">Start building your workflow</Text>
                            <Text secondary={true} size="sm">Add nodes to define the steps. Each node runs a tool and passes its output to the next.</Text>
                            <Button themed={true} icon={faPlus} onClick={() => handleAddNode(null)} className="mt-2">
                                Add First Node
                            </Button>
                        </div>
                    ) : (
                        <>
                            {nodes.map((node, idx) => (
                                <NodeCard
                                    key={node.id}
                                    node={node}
                                    index={idx}
                                    isSelected={selectedId === node.id}
                                    isOnly={nodes.length === 1}
                                    onSelect={() => setSelectedId(selectedId === node.id ? null : node.id)}
                                    onDelete={() => handleDelete(node.id)}
                                />
                            ))}

                            {/* Add node button at the end */}
                            <button
                                onClick={() => handleAddNode(nodes.length - 1)}
                                className="w-10 h-10 rounded-full border-2 border-dashed border-neutral-400 dark:border-neutral-600 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:border-accent-primary hover:text-accent-primary hover:bg-accent-primary/5 transition-all flex-shrink-0"
                                title="Add node"
                            >
                                <FontAwesomeIcon icon={faPlus} className="text-sm" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Config Panel */}
            {selectedNode && (
                <ConfigPanel
                    node={selectedNode}
                    onChange={handleChangeNode}
                    onChangeTool={handleChangeTool}
                />
            )}

            {/* Tool Picker Modal */}
            {showToolPicker && (
                <ToolPickerModal
                    onSelect={addingAfterIndex !== null || nodes.length === 0 ? handleToolSelected : handleToolChangeSelected}
                    onClose={() => { setShowToolPicker(false); setAddingAfterIndex(null) }}
                />
            )}
        </div>
    )
}
