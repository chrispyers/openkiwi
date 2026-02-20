import React from 'react';
import { faAlignLeft, faLink, faSave, faCheck, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import Button from './Button';
import { TABLE, TR, TD } from './Table';
import Card from './Card';
import { Model } from '../types';
import { EyeIcon, BrainIcon, ToolIcon } from './CapabilityIcons';
import Input from './Input';
import Text from './Text';

interface ProviderProps {
    description: string;
    endpoint: string;
    inputLabel?: string;
    inputIcon?: IconDefinition;
    inputPlaceholder?: string;
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
    inputLabel = "Endpoint",
    inputIcon = faLink,
    inputPlaceholder = "http://localhost:1234",
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
                        label={inputLabel}
                        icon={inputIcon}
                        currentText={endpoint}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEndpointChange(e.target.value)}
                        placeholder={inputPlaceholder}
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
                <Text className="uppercase" bold={true}>Available models</Text>
                <div className="rounded-xl overflow-hidden min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar">
                    {models.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[150px] gap-2">
                            <TABLE header={[
                                { name: "Model Name", alignment: "left" },
                                { name: "Capabilities", alignment: "center" },
                                { name: "Status", alignment: "center" }
                            ]} className="w-full">
                                <></>
                            </TABLE>
                            <Text secondary={true}>No models found yet.</Text>
                            <Text secondary={true}>Enter a {inputLabel.toLowerCase()} and click Scan.</Text>
                        </div>
                    ) : (
                        <TABLE header={[
                            { name: "Model Name", alignment: "left" },
                            { name: "Capabilities", alignment: "center" },
                            { name: "Status", alignment: "center" }
                        ]} className="w-full">
                            {models.map((m) => {
                                const modelId = (m.id || "").toLowerCase();
                                const displayName = (m.displayName || m.display_name || "").toLowerCase();
                                const description = (m.description || "").toLowerCase();

                                // Vision detection
                                const isVision = m.capabilities?.vision ||
                                    modelId.includes("vision") ||
                                    modelId.includes("flash") ||
                                    modelId.includes("pro") ||
                                    displayName.includes("vision") ||
                                    displayName.includes("flash") ||
                                    displayName.includes("pro");

                                // Tool detection
                                const isTool = m.capabilities?.trained_for_tool_use ||
                                    modelId.includes("tool") ||
                                    modelId.includes("flash") ||
                                    modelId.includes("pro") ||
                                    displayName.includes("tool") ||
                                    displayName.includes("flash") ||
                                    displayName.includes("pro") ||
                                    description.includes("tool");

                                // Reasoning detection
                                const isReasoning = m.capabilities?.reasoning ||
                                    m.thinking === true ||
                                    modelId.includes("deepseek-r1") ||
                                    modelId.includes("o1") ||
                                    modelId.includes("reasoning") ||
                                    modelId.includes("thinking") ||
                                    displayName.includes("deepseek-r1") ||
                                    displayName.includes("o1") ||
                                    displayName.includes("reasoning") ||
                                    displayName.includes("thinking");

                                return (
                                    <TR
                                        key={m.id}
                                        highlight={model === m.id}
                                        onClick={() => onModelChange(m.id)}
                                        className={model === m.id ? "!bg-accent-primary/10" : ""}
                                    >
                                        <TD>
                                            <Text className="font-mono" size="sm">
                                                {m.id}
                                            </Text>
                                        </TD>
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
