import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Text from '../Text'
import Card from '../Card'
import Button from '../Button'
import Input from '../Input'
import Select from '../Select'
import TextArea from '../TextArea'
import { Agent, Workflow, WorkflowState } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faGripVertical, faSave } from '@fortawesome/free-solid-svg-icons'

interface WorkflowBuilderProps {
    workflow: Workflow;
    gatewayAddr: string;
    gatewayToken: string;
    agents: Agent[];
}

export default function WorkflowBuilder({ workflow, gatewayAddr, gatewayToken, agents }: WorkflowBuilderProps) {
    const [states, setStates] = useState<WorkflowState[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchStates = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setStates(data.sort((a: WorkflowState, b: WorkflowState) => a.order_index - b.order_index));
                } else {
                    toast.error("Failed to load workflow states");
                }
            } catch (e) {
                console.error(e);
                toast.error("Error loading workflow states");
            } finally {
                setLoading(false);
            }
        };
        fetchStates();
    }, [workflow.id, gatewayAddr, gatewayToken]);

    const handleAddState = () => {
        const newState: WorkflowState = {
            id: `temp-${Date.now()}`, // Temporary string ID
            workflow_id: workflow.id,
            name: `State ${states.length + 1}`,
            order_index: states.length,
            assigned_agent_id: null,
            instructions: ''
        };
        setStates([...states, newState]);
    };

    const handleRemoveState = (index: number) => {
        const newStates = [...states];
        newStates.splice(index, 1);
        // Reorder
        newStates.forEach((s, i) => s.order_index = i);
        setStates(newStates);
    };

    const handleStateChange = (index: number, field: keyof WorkflowState, value: any) => {
        const newStates = [...states];
        newStates[index] = { ...newStates[index], [field]: value };
        setStates(newStates);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // First we do a hacky sync: delete all and recreate, or update existing.
            // In a real app we'd have a sync endpoint. For now let's just use POST/PUT.
            // Assuming there's a POST /api/workflows/:id/states to create/update

            for (const state of states) {
                const method = state.id.startsWith('temp-') ? 'POST' : 'PUT';
                const url = state.id.startsWith('temp-')
                    ? `${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`
                    : `${gatewayAddr.replace(/\/$/, '')}/api/collaboration/states/${state.id}`;

                const res = await fetch(url, {
                    method,
                    headers: {
                        'Authorization': `Bearer ${gatewayToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: state.name,
                        order_index: state.order_index,
                        assigned_agent_id: state.assigned_agent_id,
                        instructions: state.instructions
                    })
                });

                if (!res.ok) throw new Error("Failed to save state " + state.name);
            }
            toast.success("Workflow saved successfully");

            // Refetch to get real IDs
            const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/workflows/${workflow.id}/states`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStates(data.sort((a: WorkflowState, b: WorkflowState) => a.order_index - b.order_index));
            }
        } catch (e) {
            console.error(e);
            toast.error("Error saving workflow");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center"><Text secondary={true}>Loading builder...</Text></div>;
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-xl border border-border-color">
            <div className="p-6 border-b border-border-color flex justify-between items-center bg-neutral-50 dark:bg-black/20 rounded-t-xl">
                <div>
                    <Text size="lg" bold={true}>Workflow Pipeline</Text>
                    <Text size="sm" secondary={true} className="mt-1">Define the stages tasks will go through and the AI agents responsible for them.</Text>
                </div>
                <Button themed={true} icon={faSave} onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Pipeline"}
                </Button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 max-w-4xl custom-scrollbar">
                {states.map((state, index) => (
                    <Card key={state.id} className="flex gap-4 items-start bg-neutral-50/50 dark:bg-neutral-800/30">
                        <div className="cursor-grab text-neutral-400 py-4 px-2 hover:text-neutral-600 dark:hover:text-neutral-300 mt-4">
                            <FontAwesomeIcon icon={faGripVertical} />
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Stage Name"
                                    currentText={state.name}
                                    onChange={(e) => handleStateChange(index, 'name', e.target.value)}
                                    placeholder="e.g. Code Review"
                                    className="!mt-0"
                                />

                                <Select
                                    label="Assigned Agent"
                                    value={state.assigned_agent_id || ""}
                                    onChange={(e) => handleStateChange(index, 'assigned_agent_id', e.target.value ? e.target.value : null)}
                                    options={[
                                        { value: "", label: "-- Unassigned (Manual) --" },
                                        ...agents.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))
                                    ]}
                                />
                            </div>

                            <TextArea
                                label="Stage Instructions"
                                currentText={state.instructions || ''}
                                onChange={(e) => handleStateChange(index, 'instructions', e.target.value)}
                                placeholder="e.g. Please review the 0-CONCEPT.md file and output a detailed plan."
                                rows={3}
                                className="!mt-0"
                            />
                        </div>

                        <Button
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 mt-6"
                            icon={faTrash}
                            onClick={() => handleRemoveState(index)}
                        >
                            Remove
                        </Button>
                    </Card>
                ))}

                {states.length === 0 && (
                    <div className="text-center p-10 border-2 border-dashed border-border-color rounded-xl">
                        <Text secondary={true}>No stages defined yet. Every workflow needs at least one stage.</Text>
                    </div>
                )}

                <div className="pt-4 flex justify-center">
                    <Button themed={false} icon={faPlus} onClick={handleAddState} className="w-full max-w-md border-dashed border-2">
                        Add Pipeline Stage
                    </Button>
                </div>
            </div>
        </div>
    );
}
