import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Page from './Page'
import Text from '../Text'
import Card from '../Card'
import Button from '../Button'
import KanbanBoard from '../Workflows/KanbanBoard'
import WorkflowBuilder from '../Workflows/WorkflowBuilder'
import { Agent, Workflow, WorkflowState, Task } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faDiagramProject, faArrowLeft, faGears, faListCheck } from '@fortawesome/free-solid-svg-icons'

interface WorkflowsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
    agents: Agent[];
}

export default function WorkflowsPage({ gatewayAddr, gatewayToken, agents }: WorkflowsPageProps) {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [viewMode, setViewMode] = useState<'kanban' | 'builder'>('kanban');

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setWorkflows(data);
                } else {
                    toast.error("Failed to load workflows");
                }
            } catch (e) {
                console.error("Error fetching workflows:", e);
                toast.error("Error fetching workflows");
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflows();
    }, [gatewayAddr, gatewayToken]);

    const handleCreateWorkflow = async () => {
        const name = prompt("Enter workflow name:");
        if (!name) return;
        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gatewayToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description: '' })
            });
            if (res.ok) {
                const newWorkflow = await res.json();
                setWorkflows([newWorkflow, ...workflows]);
                setSelectedWorkflow(newWorkflow);
                setViewMode('builder');
                toast.success("Workflow created!");
            } else {
                toast.error("Failed to create workflow");
            }
        } catch (e) {
            console.error("Error creating workflow:", e);
            toast.error("Error creating workflow");
        }
    };

    return (
        <Page
            title="Workflows"
            subtitle="Coordinate multi-agent collaboration with pipelines and automated handoffs."
            headerAction={
                selectedWorkflow ? (
                    <div className="flex gap-2">
                        <Button
                            themed={viewMode === 'kanban'}
                            icon={faListCheck}
                            onClick={() => setViewMode('kanban')}
                        >
                            Kanban Board
                        </Button>
                        <Button
                            themed={viewMode === 'builder'}
                            icon={faGears}
                            onClick={() => setViewMode('builder')}
                        >
                            Workflow Builder
                        </Button>
                        <div className="w-px bg-border-color mx-2"></div>
                        <Button icon={faArrowLeft} onClick={() => setSelectedWorkflow(null)}>
                            Back
                        </Button>
                    </div>
                ) : (
                    <Button themed={true} icon={faPlus} onClick={handleCreateWorkflow}>
                        Create Workflow
                    </Button>
                )
            }
        >
            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <Text secondary={true}>Loading workflows...</Text>
                </div>
            ) : selectedWorkflow ? (
                viewMode === 'kanban' ? (
                    <div className="flex-1 h-full flex flex-col min-h-0 bg-transparent">
                        {/* Kanban View */}
                        <KanbanBoard
                            workflow={selectedWorkflow}
                            gatewayAddr={gatewayAddr}
                            gatewayToken={gatewayToken}
                            agents={agents}
                        />
                    </div>
                ) : (
                    <div className="flex-1 h-full flex flex-col">
                        {/* Builder View */}
                        <div className="flex-1 h-full min-h-[500px] bg-neutral-100 dark:bg-neutral-800/50 rounded-xl p-4 overflow-x-auto">
                            <WorkflowBuilder
                                workflow={selectedWorkflow}
                                gatewayAddr={gatewayAddr}
                                gatewayToken={gatewayToken}
                                agents={agents}
                            />
                        </div>
                    </div>
                )
            ) : workflows.length === 0 ? (
                <div className="text-center p-20 space-y-4">
                    <div className="w-20 h-20 bg-accent-primary/10 text-accent-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <FontAwesomeIcon icon={faDiagramProject} className="text-3xl" />
                    </div>
                    <Text size="xl" bold={true}>No workflows yet</Text>
                    <Text secondary={true}>Create a workflow to orchestrate complex tasks across multiple agents.</Text>
                    <div className="pt-4">
                        <Button themed={true} icon={faPlus} onClick={handleCreateWorkflow}>
                            Create Workflow
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workflows.map(wf => (
                        <Card
                            key={wf.id}
                            className="cursor-pointer hover:border-accent-primary transition-colors"
                            onClick={() => setSelectedWorkflow(wf)}
                        >
                            <Text bold={true} size="lg">{wf.name}</Text>
                            <Text size="sm" secondary={true} className="mt-2 line-clamp-2">{wf.description}</Text>
                        </Card>
                    ))}
                </div>
            )}
        </Page>
    );
}
