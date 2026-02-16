import React from 'react';
import { faAlignLeft, faCube, faLink, faSave } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Globe, RefreshCw } from 'lucide-react';
import Button from './Button';
import Select from './Select';
import Text from './Text';
import Card from './Card';
import IconBox from './IconBox';

interface ProviderProps {
    description: string;
    endpoint: string;
    model: string;
    models: string[];
    onDescriptionChange: (value: string) => void;
    onEndpointChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onScan: () => Promise<void>;
    onSave: () => Promise<void>;
    isEditable?: boolean;
}

export default function Provider({
    description,
    endpoint,
    model,
    models,
    onDescriptionChange,
    onEndpointChange,
    onModelChange,
    onScan,
    onSave,
    isEditable = true
}: ProviderProps) {
    return (
        <Card className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <IconBox icon={<Globe size={20} />} />
                <Text bold={true} size="xl">Model & Provider Settings</Text>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <FontAwesomeIcon icon={faAlignLeft} size="sm" /> Description
                </label>
                <input
                    type="text"
                    className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="A short description for this provider..."
                    disabled={!isEditable}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} size="sm" /> Endpoint
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 bg-bg-primary border border-border-color rounded-xl px-5 py-3 outline-none focus:border-accent-primary transition-all text-sm"
                            value={endpoint}
                            onChange={(e) => onEndpointChange(e.target.value)}
                            placeholder="http://localhost:1234/v1"
                            disabled={!isEditable}
                        />
                        <Button
                            themed={true}
                            className="px-6 text-white whitespace-nowrap flex items-center justify-center shrink-0"
                            onClick={onScan}
                            disabled={!isEditable}
                        >
                            <RefreshCw size={16} className="mr-2" />
                            Scan
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Select
                        icon={faCube}
                        className="!mt-0"
                        label="Model"
                        value={model}
                        onChange={(e) => onModelChange(e.target.value)}
                        options={[
                            { value: '', label: 'Select a model...' },
                            ...models.map(m => ({ value: m, label: m }))
                        ]}
                        disabled={!isEditable}
                    />
                </div>
            </div>

            <Button
                themed={true}
                className="w-full h-12 text-white"
                onClick={onSave}
                icon={faSave}
                disabled={!isEditable}
            >
                {isEditable ? "Save Provider Configurations" : "Update Provider"}
            </Button>
        </Card>
    );
}
