import { useState } from 'react';
import { TABLE, TR, TD, TH } from "./Table";
import DeleteButton from "./DeleteButton";
import Modal from "./Modal";
import Button from "./Button";

interface Provider {
    description: string;
    endpoint: string;
    model: string;
    apiKey?: string;
}

interface ModelsTableProps {
    providers: Provider[];
    onRowClick: (index: number) => void;
    highlight?: boolean;
    onDelete?: (index: number) => void;
}

export default function ModelsTable({ providers, onRowClick, highlight = false, onDelete }: ModelsTableProps) {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [providerToDeleteIndex, setProviderToDeleteIndex] = useState<number | null>(null);

    const getProviderName = (endpoint: string) => {
        if (endpoint.includes('generativelanguage.googleapis.com')) return 'Google Gemini';
        if (endpoint.includes('api.openai.com')) return 'OpenAI';
        if (endpoint.includes(':1234')) return 'LM Studio';
        return 'Custom Provider';
    };

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
            <div className="text-center py-20 opacity-50">
                <p>No providers configured yet. Click "Add Provider" to get started.</p>
            </div>
        );
    }

    return (
        <>
            <TABLE header={["Model", "Description", "Capabilities", ""]} className="w-full text-left text-sm">
                {providers.map((provider, idx) => (
                    <TR key={idx} highlight={highlight} onClick={() => onRowClick(idx)}>
                        <TD className="px-6 py-4 font-mono text-accent-primary">
                            {provider.model}
                        </TD>
                        <TD className="px-6 py-4 text-text-secondary">
                            {provider.description}
                        </TD>
                        <TD className="px-6 py-4 text-text-secondary">
                            {/* {provider.capabilities} */}
                        </TD>
                        <TD className="px-2 py-4 w-10 text-center">
                            {onDelete && (
                                <DeleteButton onClick={(e) => handleDeleteClick(e, idx)} />
                            )}
                        </TD>
                    </TR>
                ))}
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
                            className="bg-rose-500 hover:bg-rose-600 text-white dark:bg-rose-600 dark:hover:bg-rose-700"
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
