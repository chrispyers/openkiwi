import { useState } from 'react';
import { TABLE, TR, TD, TH } from "./Table";
import DeleteButton from "./DeleteButton";
import Modal from "./Modal";
import Button from "./Button";
import { EyeIcon, BrainIcon, ToolIcon } from './CapabilityIcons';
import Text from './Text';
import Badge from './Badge';
import { Agent } from '../types';

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
                { name: "AGENTS", alignment: "center" },
                { name: "" }
            ]}>
                {providers.map((provider, idx) => {
                    const usingAgents = agents.filter(a => a.provider === provider.description);

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
                            <TD className="w-1/4">
                                <div className="justify-center flex flex-wrap gap-2">
                                    {usingAgents.length > 0 ? (
                                        usingAgents.map(agent => (
                                            <Badge key={agent.id}>
                                                {agent.emoji} {agent.name}
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
