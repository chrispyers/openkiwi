import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Page from './Page'
import Text from '../Text'
import Card from '../Card'
import Column from '../Column'
import Button from '../Button'
import WorkflowBuilder from '../Workflows/WorkflowBuilder'
import { Workflow } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faDiagramProject, faArrowLeft, faTrash, faPen } from '@fortawesome/free-solid-svg-icons'

interface WorkflowsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
}

export default function WorkflowsPage({ gatewayAddr, gatewayToken }: WorkflowsPageProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
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
                const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                })
                if (res.ok) {
                    setWorkflows(await res.json())
                } else {
                    toast.error('Failed to load workflows')
                }
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
            {showNewDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowNewDialog(false); setNewName('') }}>
                    <div className="bg-bg-primary border border-border rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
                        <Text bold={true} size="lg">New Workflow</Text>
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkflow(); if (e.key === 'Escape') { setShowNewDialog(false); setNewName('') } }}
                            placeholder="Workflow name"
                            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm outline-none focus:border-accent-primary"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button onClick={() => { setShowNewDialog(false); setNewName('') }}>Cancel</Button>
                            <Button themed={true} onClick={handleCreateWorkflow} disabled={!newName.trim()}>Create</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename dialog */}
            {pendingRename && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setPendingRename(null); setRenameName('') }}>
                    <div className="bg-bg-primary border border-border rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
                        <Text bold={true} size="lg">Rename Workflow</Text>
                        <input
                            ref={renameInputRef}
                            type="text"
                            value={renameName}
                            onChange={e => setRenameName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameWorkflow(); if (e.key === 'Escape') { setPendingRename(null); setRenameName('') } }}
                            placeholder="Workflow name"
                            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm outline-none focus:border-accent-primary"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button onClick={() => { setPendingRename(null); setRenameName('') }}>Cancel</Button>
                            <Button themed={true} onClick={handleRenameWorkflow} disabled={!renameName.trim()}>Rename</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation dialog */}
            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPendingDelete(null)}>
                    <div className="bg-bg-primary border border-border rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
                        <Text bold={true} size="lg">Delete Workflow</Text>
                        <Text secondary={true}>Delete <span className="text-primary font-medium">"{pendingDelete.name}"</span>? This cannot be undone.</Text>
                        <div className="flex gap-2 justify-end">
                            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
                            <button
                                onClick={handleDeleteWorkflow}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    <Column>
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
                            {wf.description && (
                                <Text size="sm" secondary={true} className="mt-2 line-clamp-2">{wf.description}</Text>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </Page>
    )
}
