import { useState } from 'react';
import { TABLE, TR, TD, TH } from "./Table";
import DeleteButton from "./DeleteButton";
import Modal from "./Modal";
import Button from "./Button";
import { EyeIcon, BrainIcon, ToolIcon } from './CapabilityIcons';
import Text from './Text';
import Badge from './Badge';
import { Agent } from '../types';
import AgentAvatar from './AgentAvatar';

interface Provider {
    description: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    capabilities?: {
        vision?: boolean;
        reasoning?: boolean;
        trained_for_tool_use?: boolean;
    };
    max_context_length?: number;
}

interface ModelsTableProps {
    providers: Provider[];
    onRowClick: (index: number) => void;
    highlight?: boolean;
    onDelete?: (index: number) => void;
    agents?: Agent[];
}

export default function ModelsTable({ providers, onRowClick, highlight = false, onDelete, agents = [] }: ModelsTableProps) {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [providerToDeleteIndex, setProviderToDeleteIndex] = useState<number | null>(null);

    const handleDeleteClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setProviderToDeleteIndex(index);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (providerToDeleteIndex !== null && onDelete) {
            onDelete(providerToDeleteIndex);
        }
        setIsDeleteModalOpen(false);
        setProviderToDeleteIndex(null);
    };

    if (!providers || providers.length === 0) {
        return (
            <div className="text-center py-20">
                <Text secondary={true}>
                    No models configured yet. Click "Add Model" to get started.
                </Text>
            </div>
        );
    }

    return (
        <>
            <TABLE header={[
                { name: "Model", alignment: "left" },
                { name: "Description", alignment: "left" },
                { name: "Capabilities", alignment: "center" },
                { name: "Max Context", alignment: "center" },
                { name: "AGENTS", alignment: "center" },
                { name: "" }
            ]}>
                {providers.map((provider, idx) => {
                    const usingAgents = agents.filter(a => a.provider === provider.description);

                    const formatContextLength = (n: number) => {
                        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
                        if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
                        return `${n}`;
                    };

                    return (
                        <TR key={idx} highlight={highlight} onClick={() => onRowClick(idx)}>
                            <TD className="w-1/4">
                                <Text className="font-mono" size="sm">
                                    {provider.model}
                                </Text>
                            </TD>
                            <TD className="w-1/4">
                                <Text>
                                    {provider.description}
                                </Text>
                            </TD>
                            <TD>
                                <div className="flex justify-center gap-2">
                                    {provider.capabilities?.vision && <EyeIcon />}
                                    {provider.capabilities?.trained_for_tool_use && <ToolIcon />}
                                    {provider.capabilities?.reasoning && <BrainIcon />}
                                </div>
                            </TD>
                            <TD className="w-24 text-center">
                                <Text size="sm" secondary={!provider.max_context_length}>
                                    {provider.max_context_length ? formatContextLength(provider.max_context_length) : '—'}
                                </Text>
                            </TD>
                            <TD className="w-1/3">
                                <div className="justify-center flex flex-wrap gap-2">
                                    {usingAgents.length > 0 ? (
                                        usingAgents.map(agent => (
                                            <Badge key={agent.id} className="flex items-center gap-1.5 px-2 py-1">
                                                {
                                                    agent.avatar &&
                                                    <AgentAvatar agent={agent} size="sm" fallbackToInitials={false} className="!w-4 !h-4 !text-[10px] !bg-transparent mr-1" />
                                                }
                                                <span>{agent.name}</span>
                                            </Badge>
                                        ))
                                    ) : (
                                        <Text size="xs" secondary={true}>-</Text>
                                    )}
                                </div>
                            </TD>
                            <TD className="w-10 text-center">
                                {onDelete && (
                                    <DeleteButton onClick={(e) => handleDeleteClick(e, idx)} />
                                )}
                            </TD>
                        </TR>
                    );
                })}
            </TABLE>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Model"
                className="max-w-md"
            >
                <div className="p-6 space-y-6">
                    <p className="text-neutral-600 dark:text-neutral-300">
                        Are you sure you want to delete this model?
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button
                            variant="danger"
                            onClick={confirmDelete}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
