import { TABLE, TR, TD, TH } from "./Table";

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
}

export default function ModelsTable({ providers, onRowClick, highlight = false }: ModelsTableProps) {
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
        <TABLE header={["Model", "Description"]} className="w-full text-left text-sm">
            {providers.map((provider, idx) => (
                <TR key={idx} highlight={highlight} onClick={() => onRowClick(idx)}>
                    <TD className="px-6 py-4 font-mono text-accent-primary">
                        {provider.model}
                    </TD>
                    <TD className="px-6 py-4 text-text-secondary">
                        {provider.description}
                    </TD>
                </TR>
            ))}
        </TABLE>
    );
}
