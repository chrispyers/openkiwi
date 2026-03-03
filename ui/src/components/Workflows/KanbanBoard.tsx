import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Text from '../Text'
import Card from '../Card'
import Button from '../Button'
import Badge from '../Badge'
import { Agent, Workflow, WorkflowState, Task } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faClock, faUser } from '@fortawesome/free-solid-svg-icons'
import TaskDetailsModal from './TaskDetailsModal'

interface KanbanBoardProps {
    workflow: Workflow;
    gatewayAddr: string;
    gatewayToken: string;
    agents: Agent[];
}

export default function KanbanBoard({ workflow, gatewayAddr, gatewayToken, agents }: KanbanBoardProps) {
    const [states, setStates] = useState<WorkflowState[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const fetchBoardData = async () => {
        setLoading(true);
        try {
            // Fetch states
            const statesRes = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });

            // Fetch tasks
            const tasksRes = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/tasks?workflowId=${workflow.id}`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });

            if (statesRes.ok && tasksRes.ok) {
                const statesData = await statesRes.json();
                const tasksData = await tasksRes.json();
                setStates(statesData.sort((a: WorkflowState, b: WorkflowState) => a.order_index - b.order_index));
                setTasks(tasksData);
            } else {
                toast.error("Failed to load workflow data");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error loading workflow data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoardData();
        // Set up polling
        const interval = setInterval(fetchBoardData, 5000);
        return () => clearInterval(interval);
    }, [workflow.id, gatewayAddr, gatewayToken]);

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return "Unassigned";
        const agent = agents.find(a => a.id === agentId);
        return agent ? agent.name : agentId;
    };

    const handleCreateTask = async (stateId: string) => {
        const title = prompt("Enter task title:");
        if (!title) return;
        const description = prompt("Enter task description (optional):") || "";

        try {
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gatewayToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workflow_id: workflow.id,
                    state_id: String(stateId),
                    title,
                    description
                })
            });

            if (res.ok) {
                toast.success("Task created!");
                fetchBoardData(); // Refetch board
            } else {
                toast.error("Failed to create task");
            }
        } catch (e) {
            console.error("Error creating task:", e);
            toast.error("Error creating task");
        }
    };

    if (loading && states.length === 0) {
        return <div className="p-10 text-center"><Text secondary={true}>Loading board...</Text></div>;
    }

    if (states.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <Text size="lg" bold={true}>No states defined</Text>
                <Text secondary={true} className="mt-2">Use the Workflow Builder to add stages (e.g., Todo, In Progress, Done).</Text>
            </div>
        );
    }

    return (
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {states.map(state => {
                const columnTasks = tasks.filter(t => t.state_id === state.id);
                return (
                    <div key={state.id} className="flex-shrink-0 w-80 bg-neutral-200/50 dark:bg-neutral-800/80 rounded-xl flex flex-col max-h-full">
                        <div className="p-4 bg-white/50 dark:bg-black/20 font-bold border-b border-border-color rounded-t-xl flex justify-between items-center">
                            <Text>{state.name}</Text>
                            <Badge>{columnTasks.length}</Badge>
                        </div>
                        <div className="p-2 pb-0 opacity-80 text-xs px-4 flex items-center gap-1 mt-2">
                            <FontAwesomeIcon icon={faUser} />
                            <Text secondary={true}>{getAgentName(state.assigned_agent_id)}</Text>
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {columnTasks.map(task => (
                                <Card
                                    key={task.id}
                                    className="cursor-pointer hover:border-accent-primary transition-colors p-4 space-y-3"
                                    onClick={() => setSelectedTask(task)}
                                >
                                    <Text bold={true}>{task.title}</Text>
                                    <Text size="sm" secondary={true} className="line-clamp-2">{task.description}</Text>

                                    <div className="flex items-center justify-between pt-2 border-t border-border-color">
                                        <Text size="xs" secondary={true}>
                                            <FontAwesomeIcon icon={faClock} className="mr-1" />
                                            {new Date(task.updated_at).toLocaleDateString()}
                                        </Text>
                                        {task.locked_by && (
                                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none text-[10px]">
                                                Locked
                                            </Badge>
                                        )}
                                    </div>
                                </Card>
                            ))}
                            {columnTasks.length === 0 && (
                                <div className="text-center p-4 border-2 border-dashed border-border-color rounded-xl">
                                    <Text size="sm" secondary={true}>No tasks</Text>
                                </div>
                            )}
                        </div>
                        <div className="p-3 border-t border-border-color bg-neutral-100 dark:bg-black/10 rounded-b-xl shrink-0">
                            <Button className="w-full justify-center" themed={false} icon={faPlus} onClick={() => handleCreateTask(state.id)}>
                                Add Task
                            </Button>
                        </div>
                    </div>
                );
            })}

            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    states={states}
                    agents={agents}
                    isOpen={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    gatewayAddr={gatewayAddr}
                    gatewayToken={gatewayToken}
                />
            )}
        </div>
    );
}
