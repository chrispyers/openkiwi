import React from 'react';
import { faAlignLeft, faLink, faSave, faCheck, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from './Button';
import { TABLE, TR, TD } from './Table';
import Card from './Card';
import { Model } from '../types';
import { EyeIcon, BrainIcon, ToolIcon } from './CapabilityIcons';
import Input from './Input';

interface ProviderProps {
    description: string;
    endpoint: string;
    model: string;
    models: Model[];
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
            <div className="space-y-2">
                <div className="flex gap-2 items-end">
                    <Input
                        label="Endpoint"
                        icon={faLink}
                        currentText={endpoint}
                        onChange={(e) => onEndpointChange(e.target.value)}
                        placeholder="http://localhost:1234"
                        clearText={() => onEndpointChange("")}
                    />
                    <Button
                        themed={true}
                        className="px-6 text-white whitespace-nowrap flex items-center justify-center shrink-0 mb-1"
                        onClick={onScan}
                        disabled={!isEditable}
                        icon={faRefresh}>Scan</Button>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">Available Models</label>
                <div className="bg-bg-primary border border-border-color rounded-xl overflow-hidden min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar">
                    {models.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[150px] text-neutral-400 gap-2">
                            <p className="text-sm">No models found yet.</p>
                            <p className="text-xs">Enter an endpoint and click Scan.</p>
                        </div>
                    ) : (
                        <TABLE header={["Model Name", "Capabilities", "Status"]} className="w-full">
                            {models.map((m) => {
                                const isVision = m.capabilities?.vision;
                                const isTool = m.capabilities?.trained_for_tool_use;
                                const isReasoning = (m.id || "").toLowerCase().includes("deepseek-r1") ||
                                    (m.id || "").toLowerCase().includes("o1") ||
                                    (m.id || "").toLowerCase().includes("reasoning") ||
                                    (m.display_name || "").toLowerCase().includes("deepseek-r1") ||
                                    (m.display_name || "").toLowerCase().includes("o1") ||
                                    (m.display_name || "").toLowerCase().includes("reasoning");

                                return (
                                    <TR
                                        key={m.id}
                                        highlight={model === m.id}
                                        onClick={() => onModelChange(m.id)}
                                        className={model === m.id ? "!bg-accent-primary/10" : ""}
                                    >
                                        <TD className="font-mono text-sm">{m.id}</TD>
                                        <TD>
                                            <div className="flex gap-2 justify-center">
                                                {isVision && <EyeIcon />}
                                                {isTool && <ToolIcon />}
                                                {isReasoning && <BrainIcon />}
                                            </div>
                                        </TD>
                                        <TD className="w-24 text-center">
                                            {model === m.id && (
                                                <div className="text-accent-primary flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider">
                                                    <FontAwesomeIcon icon={faCheck} /> Selected
                                                </div>
                                            )}
                                        </TD>
                                    </TR>
                                );
                            })}
                        </TABLE>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Input
                    label="(optional) Description"
                    icon={faAlignLeft}
                    currentText={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="A short description of this model"
                    clearText={() => onDescriptionChange("")}
                />
            </div>

            <Button
                themed={true}
                className="w-full h-12 text-white"
                onClick={onSave}
                icon={faSave}
                disabled={!isEditable || !model}
            >
                {isEditable ? "Save Model" : "Update Model"}
            </Button>
        </Card>
    );
}
