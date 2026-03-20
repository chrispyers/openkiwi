import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Page from './Page'
import Text from '../Text'
import Card from '../Card'
import Column from '../Column'
import Button from '../Button'
import Modal from '../Modal'
import Input from '../Input'
import WorkflowBuilder from '../Workflows/WorkflowBuilder'
import { getToolDef, toolIdFromInstructions } from '../Workflows/toolDefs'
import { Workflow, WorkflowState } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faDiagramProject, faArrowLeft, faTrash, faPen, faArrowRight } from '@fortawesome/free-solid-svg-icons'

interface WorkflowsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
}

export default function WorkflowsPage({ gatewayAddr, gatewayToken }: WorkflowsPageProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [workflowNodes, setWorkflowNodes] = useState<Record<string, WorkflowState[]>>({})
    const [loading, setLoading] = useState(true)
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
    const [showNewDialog, setShowNewDialog] = useState(false)
    const [newName, setNewName] = useState('')
    const [pendingDelete, setPendingDelete] = useState<Workflow | null>(null)
    const [pendingRename, setPendingRename] = useState<Workflow | null>(null)
    const [renameName, setRenameName] = useState('')
    const nameInputRef = useRef<HTMLInputElement>(null)
    const renameInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const base = gatewayAddr.replace(/\/$/, '')
                const headers = { 'Authorization': `Bearer ${gatewayToken}` }
                const res = await fetch(`${base}/api/collaboration/workflows`, { headers })
                if (!res.ok) { toast.error('Failed to load workflows'); return }
                const list: Workflow[] = await res.json()
                setWorkflows(list)
                // Fetch states for all workflows in parallel
                const entries = await Promise.all(
                    list.map(async wf => {
                        try {
                            const r = await fetch(`${base}/api/collaboration/workflows/${wf.id}/states`, { headers })
                            const states: WorkflowState[] = r.ok ? await r.json() : []
                            return [wf.id, states.sort((a, b) => a.order_index - b.order_index)] as const
                        } catch { return [wf.id, []] as const }
                    })
                )
                setWorkflowNodes(Object.fromEntries(entries))
            } catch (e) {
                console.error(e)
                toast.error('Error fetching workflows')
            } finally {
                setLoading(false)
            }
        }
        fetchWorkflows()
    }, [gatewayAddr, gatewayToken])

    useEffect(() => {
        if (showNewDialog) setTimeout(() => nameInputRef.current?.focus(), 50)
    }, [showNewDialog])

    useEffect(() => {
        if (pendingRename) setTimeout(() => renameInputRef.current?.focus(), 50)
    }, [pendingRename])

    const handleCreateWorkflow = async () => {
        if (!newName.trim()) return
        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), description: '' })
            })
            if (res.ok) {
                const created: Workflow = await res.json()
                setWorkflows(prev => [created, ...prev])
                setSelectedWorkflow(created)
                toast.success('Workflow created')
            } else {
                toast.error('Failed to create workflow')
            }
        } catch (e) {
            console.error(e)
            toast.error('Error creating workflow')
        } finally {
            setShowNewDialog(false)
            setNewName('')
        }
    }

    const handleRenameWorkflow = async () => {
        if (!pendingRename || !renameName.trim()) return
        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${pendingRename.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameName.trim() })
            })
            if (res.ok) {
                const updated: Workflow = await res.json()
                setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w))
                if (selectedWorkflow?.id === updated.id) setSelectedWorkflow(updated)
                toast.success('Workflow renamed')
            } else {
                toast.error('Failed to rename workflow')
            }
        } catch (e) {
            console.error(e)
            toast.error('Error renaming workflow')
        } finally {
            setPendingRename(null)
            setRenameName('')
        }
    }

    const handleDeleteWorkflow = async () => {
        if (!pendingDelete) return
        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${pendingDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            })
            if (res.ok) {
                setWorkflows(prev => prev.filter(w => w.id !== pendingDelete.id))
                setWorkflowNodes(prev => { const next = { ...prev }; delete next[pendingDelete.id]; return next })
                toast.success('Workflow deleted')
            } else {
                toast.error('Failed to delete workflow')
            }
        } catch (e) {
            console.error(e)
            toast.error('Error deleting workflow')
        } finally {
            setPendingDelete(null)
        }
    }

    return (
        <Page
            title="Workflows"
            subtitle="Build automated pipelines by connecting tools together."
            headerAction={
                selectedWorkflow ? (
                    <Button icon={faArrowLeft} onClick={() => setSelectedWorkflow(null)}>
                        All Workflows
                    </Button>
                ) : (
                    <Button themed={true} icon={faPlus} onClick={() => setShowNewDialog(true)}>
                        New Workflow
                    </Button>
                )
            }
        >
            {/* New workflow dialog */}
            <Modal isOpen={showNewDialog} onClose={() => { setShowNewDialog(false); setNewName('') }} title="New Workflow" className="max-w-sm">
                <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); handleCreateWorkflow(); }}>
                    <Input
                        ref={nameInputRef}
                        currentText={newName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                        placeholder="Workflow name"
                    />
                    <div className="flex gap-2 justify-end">
                        <Button onClick={() => { setShowNewDialog(false); setNewName('') }}>Cancel</Button>
                        <Button themed={true} disabled={!newName.trim()}>Create</Button>
                    </div>
                </form>
            </Modal>

            {/* Rename dialog */}
            <Modal isOpen={!!pendingRename} onClose={() => { setPendingRename(null); setRenameName('') }} title="Rename Workflow" className="max-w-sm">
                <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); handleRenameWorkflow(); }}>
                    <Input
                        ref={renameInputRef}
                        currentText={renameName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameName(e.target.value)}
                        placeholder="Workflow name"
                    />
                    <div className="flex gap-2 justify-end">
                        <Button onClick={() => { setPendingRename(null); setRenameName('') }}>Cancel</Button>
                        <Button themed={true} disabled={!renameName.trim()}>Rename</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete confirmation dialog */}
            <Modal isOpen={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete Workflow" className="max-w-sm">
                <div className="p-6 space-y-4">
                    <Text secondary={true}>Delete <span className="text-primary font-medium">"{pendingDelete?.name}"</span>? This cannot be undone.</Text>
                    <div className="flex gap-2 justify-end">
                        <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteWorkflow}>Delete</Button>
                    </div>
                </div>
            </Modal>

            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <Text secondary={true}>Loading workflows…</Text>
                </div>
            ) : selectedWorkflow ? (
                <div className="flex-1 h-full flex flex-col min-h-[500px]">
                    <WorkflowBuilder
                        workflow={selectedWorkflow}
                        gatewayAddr={gatewayAddr}
                        gatewayToken={gatewayToken}
                    />
                </div>
            ) : workflows.length === 0 ? (
                <div className="text-center p-20 space-y-4">
                    <div className="w-20 h-20 bg-accent-primary/10 text-accent-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <FontAwesomeIcon icon={faDiagramProject} className="text-3xl" />
                    </div>
                    <Text size="xl" bold={true}>No workflows yet</Text>
                    <Column align="center">
                        <Text secondary={true}>Create a workflow to automate tasks by chaining tools together.</Text>
                    </Column>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workflows.map(wf => (
                        <Card
                            key={wf.id}
                            className="cursor-pointer hover:border-accent-primary transition-colors relative group"
                            onClick={() => setSelectedWorkflow(wf)}
                        >
                            {/* Row 1: name + actions */}
                            <div className="flex items-start justify-between gap-2">
                                <Text bold={true} size="lg">{wf.name}</Text>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-1 -mr-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPendingRename(wf); setRenameName(wf.name) }}
                                        className="text-secondary hover:text-primary p-1"
                                        title="Rename workflow"
                                    >
                                        <FontAwesomeIcon icon={faPen} className="text-sm" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPendingDelete(wf) }}
                                        className="text-secondary hover:text-red-500 p-1"
                                        title="Delete workflow"
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                    </button>
                                </div>
                            </div>

                            {/* Row 2: node icons */}
                            {(() => {
                                const nodes = workflowNodes[wf.id]
                                if (!nodes || nodes.length === 0) return null
                                return (
                                    <div className="flex items-center gap-1 mt-3 flex-wrap">
                                        {nodes.map((node, idx) => {
                                            const tool = getToolDef(toolIdFromInstructions(node.instructions))
                                            return (
                                                <div key={node.id} className="flex items-center gap-1">
                                                    <div
                                                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: tool.color + '22', color: tool.color }}
                                                        title={tool.name}
                                                    >
                                                        <FontAwesomeIcon icon={tool.icon} className="text-xs" />
                                                    </div>
                                                    {idx < nodes.length - 1 && (
                                                        <FontAwesomeIcon icon={faArrowRight} className="text-xs text-neutral-400 dark:text-neutral-600" />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                        </Card>
                    ))}
                </div>
            )}
        </Page>
    )
}
