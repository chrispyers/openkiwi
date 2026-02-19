
import React from 'react';

interface Provider {
    description: string;
    endpoint: string;
    model: string;
    apiKey?: string;
}

interface ModelsTableProps {
    providers: Provider[];
    onRowClick: (index: number) => void;
}

export default function ModelsTable({ providers, onRowClick }: ModelsTableProps) {
    const getProviderName = (endpoint: string) => {
        if (endpoint.includes('generativelanguage.googleapis.com')) return 'Google Gemini';
        if (endpoint.includes('api.openai.com')) return 'OpenAI';
        if (endpoint.includes(':1234')) return 'LM Studio';
        return 'Custom Provider';
    };

    if (!providers || providers.length === 0) {
        return (
            <div className="text-center py-20 opacity-50">
                <p>No providers configured yet. Click "Add Provider" to get started.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border-color bg-bg-card shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-bg-secondary text-text-secondary font-medium uppercase text-xs tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Provider</th>
                        <th className="px-6 py-4">Model</th>
                        <th className="px-6 py-4">Description</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                    {providers.map((provider, idx) => (
                        <tr
                            key={idx}
                            onClick={() => onRowClick(idx)}
                            className="hover:bg-bg-secondary/50 cursor-pointer transition-colors"
                        >
                            <td className="px-6 py-4 font-bold text-text-primary">
                                {getProviderName(provider.endpoint)}
                            </td>
                            <td className="px-6 py-4 font-mono text-accent-primary">
                                {provider.model}
                            </td>
                            <td className="px-6 py-4 text-text-secondary">
                                {provider.description}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
