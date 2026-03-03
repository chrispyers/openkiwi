import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Text from '../Text'
import Card from '../Card'
import Button from '../Button'
import Modal from '../Modal'
import MarkdownRenderer from '../MarkdownRenderer'
import { Agent, Task, TaskComment, WorkflowState } from '../../types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faUser, faLock } from '@fortawesome/free-solid-svg-icons'

interface TaskDetailsModalProps {
    task: Task;
    states: WorkflowState[];
    agents: Agent[];
    isOpen: boolean;
    onClose: () => void;
    gatewayAddr: string;
    gatewayToken: string;
}

export default function TaskDetailsModal({ task, states, agents, isOpen, onClose, gatewayAddr, gatewayToken }: TaskDetailsModalProps) {
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [loading, setLoading] = useState(true);

    const currentState = states.find(s => s.id === task.state_id);

    useEffect(() => {
        if (!isOpen) return;

        const fetchComments = async () => {
            setLoading(true);
            try {
                // Assuming there's a GET /api/collaboration/tasks/:id/comments endpoint
                const res = await fetch(`${gatewayAddr.replace(/\/$/, '')}/api/collaboration/tasks/${task.id}/comments`, {
                    headers: { 'Authorization': `Bearer ${gatewayToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setComments(data);
                } else {
                    toast.error("Failed to load comments");
                }
            } catch (e) {
                console.error("Error loading task comments:", e);
                // toast.error("Error loading comments");
            } finally {
                setLoading(false);
            }
        };

        fetchComments();
    }, [task.id, isOpen, gatewayAddr, gatewayToken]);

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return "System / User";
        const agent = agents.find(a => a.id === agentId);
        return agent ? `${agent.emoji} ${agent.name}` : agentId;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Task: ${task.title}`} className="max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar h-full">
                {/* Header info */}
                <div className="flex gap-6 bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-xl border border-border-color shrink-0">
                    <div>
                        <Text size="xs" secondary={true} className="uppercase tracking-wider">Current State</Text>
                        <Text bold={true} className="mt-1">{currentState?.name || 'Unknown'}</Text>
                    </div>
                    <div>
                        <Text size="xs" secondary={true} className="uppercase tracking-wider">Created</Text>
                        <Text className="mt-1 flex items-center gap-1">
                            <FontAwesomeIcon icon={faClock} className="text-neutral-400" />
                            {new Date(task.created_at).toLocaleString()}
                        </Text>
                    </div>
                    {task.locked_by && (
                        <div>
                            <Text size="xs" secondary={true} className="uppercase tracking-wider text-amber-500">Locked By</Text>
                            <Text className="mt-1 flex items-center gap-1 text-amber-500">
                                <FontAwesomeIcon icon={faLock} />
                                {getAgentName(task.locked_by)}
                            </Text>
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="shrink-0">
                    <Text size="lg" bold={true} className="mb-2">Description</Text>
                    <div className="bg-white dark:bg-bg-primary p-4 rounded-xl border border-border-color prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={task.description} />
                    </div>
                </div>

                {/* Document Content */}
                {task.document_content && (
                    <div className="shrink-0">
                        <Text size="lg" bold={true} className="mb-2">Document content</Text>
                        <div className="bg-white dark:bg-bg-primary p-4 rounded-xl border border-border-color max-h-96 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed whitespace-pre-wrap">
                            {task.document_content}
                        </div>
                    </div>
                )}

                {/* Comments / History */}
                <div className="flex-1 flex flex-col min-h-0">
                    <Text size="lg" bold={true} className="mb-4 shrink-0">Activity & Comments</Text>

                    {loading ? (
                        <div className="py-10 text-center shrink-0"><Text secondary={true}>Loading activity...</Text></div>
                    ) : comments.length === 0 ? (
                        <div className="py-10 text-center border-2 border-dashed border-border-color rounded-xl shrink-0">
                            <Text secondary={true}>No activity or comments yet.</Text>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[logo]">
                            {comments.map(comment => {
                                const isAgent = !!comment.agent_id;
                                return (
                                    <div key={comment.id} className={`flex flex-col gap-1 ${isAgent ? 'items-start' : 'items-end'}`}>
                                        <div className="flex items-center gap-2 px-1">
                                            <Text size="xs" secondary={true}>{getAgentName(comment.agent_id)}</Text>
                                            <Text size="xs" secondary={true} className="opacity-50">
                                                {new Date(comment.created_at).toLocaleString()}
                                            </Text>
                                        </div>
                                        <div className={`p-3 rounded-2xl max-w-[85%] ${isAgent
                                            ? 'bg-neutral-100 dark:bg-neutral-800 rounded-tl-none border border-border-color'
                                            : 'bg-accent-primary text-white dark:text-neutral-900 rounded-tr-none'
                                            }`}>
                                            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                                                <MarkdownRenderer content={comment.content} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-border-color bg-neutral-50 dark:bg-black/20 rounded-b-xl shrink-0">
                <Text size="sm" secondary={true} className="text-center block italic">Note: Only AI agents can interact with tasks currently. UI interaction coming soon.</Text>
            </div>
        </Modal>
    );
}
