import React, { useEffect, Fragment, useMemo } from 'react'
import {
    AlertCircle
} from 'lucide-react'
import {
    faPaperPlane,
    faSquare,
    faCode,
    faBookOpen,
    faMagnifyingGlass,
    faLightbulb
} from '@fortawesome/free-solid-svg-icons'
import Button from '../Button'
import Select from '../Select'
import { AgentChatBubble, UserChatBubble, StreamingChatBubble, ActiveToolBubble, ToolActivityRows } from '../ChatBubble'
import Text from '../Text'
import Badge from '../Badge'
import TextArea from '../TextArea'
import AgentAvatar from '../AgentAvatar'

export default function ChatPage({
    agents,
    selectedAgentId,
    setSelectedAgentId,
    messages,
    config,
    isStreaming,
    activeTool,
    inputText,
    setInputText,
    handleSend,
    handleStop,
    isGatewayConnected,
    messagesEndRef,
    textareaRef,
    chatContainerRef,
    handleScroll,
    formatTimestamp,
    contextWarning
}) {
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            const newHeight = Math.min(scrollHeight, 200);
            textareaRef.current.style.height = `${newHeight}px`;
            textareaRef.current.style.overflowY = scrollHeight > 200 ? 'auto' : 'hidden';
        }
    }, [inputText, textareaRef]);

    useEffect(() => {
        if (!selectedAgentId && agents && agents.length > 0) {
            const defaultAgent = agents.find(a => a.isDefault);
            if (defaultAgent) {
                setSelectedAgentId(defaultAgent.id);
            }
        }
    }, [agents, selectedAgentId, setSelectedAgentId]);

    const currentAgent = agents.find(a => a.id === selectedAgentId);
    const isNoAgentSelected = !selectedAgentId;
    const isAgentMissing = !currentAgent && !!selectedAgentId;

    const agentSelectData = useMemo(() => {
        const groups = {};
        const ungrouped = [];
        for (const a of (agents || [])) {
            if (a.group) {
                if (!groups[a.group]) groups[a.group] = [];
                groups[a.group].push({ value: a.id, label: a.name });
            } else {
                ungrouped.push({ value: a.id, label: a.name });
            }
        }
        const hasGroups = Object.keys(groups).length > 0;
        if (!hasGroups) {
            return {
                options: [{ value: '', label: 'Choose an Agent' }, ...ungrouped],
                optionGroups: undefined
            };
        }
        const optionGroups = Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, options]) => ({ label, options }));
        if (ungrouped.length > 0) {
            optionGroups.push({ label: 'Other', options: ungrouped });
        }
        return {
            options: [{ value: '', label: 'Choose an Agent' }],
            optionGroups
        };
    }, [agents]);

    let askUserQuestion = null;
    let askUserOptions = null;
    if (!isStreaming && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.tool_calls) {
            const askUserTool = lastMessage.tool_calls.find(tc => (tc.function?.name || tc.name) === 'ask_user');
            if (askUserTool) {
                try {
                    const args = JSON.parse(askUserTool.function?.arguments || askUserTool.arguments || '{}');
                    if (args.question) askUserQuestion = args.question;
                    if (args.options && Array.isArray(args.options)) askUserOptions = args.options;
                } catch (e) {
                    // ignore
                }
            }
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Agent ToolBar */}
            <div className="px-6 py-4 border-b border-divider flex justify-between items-center bg-surface/80 backdrop-blur-md sticky top-0 z-20">
                {isAgentMissing ? (
                    <div className="flex items-center gap-4 w-full">
                        <AgentAvatar className="!bg-neutral-200 dark:!bg-neutral-800">
                            <AlertCircle size={18} className="text-neutral-500" />
                        </AgentAvatar>
                        <div className="text-sm font-bold text-neutral-500">
                            Agent Deleted
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 w-full">
                        {messages.length > 0 && currentAgent && (
                            <>
                                <AgentAvatar agent={currentAgent} size="sm" />
                                <Text bold={true} size="lg">{currentAgent.name}</Text>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-6 lg:px-12 py-8 space-y-6"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <AgentAvatar agent={currentAgent} size="xl" className="mb-6 animate-bounce-slow" />
                        <div className="flex items-center justify-center gap-4 flex-nowrap mb-6 w-full max-w-lg mx-auto">
                            <Text size="3xl" bold={true} className="whitespace-nowrap">Chat with</Text>
                            <Select
                                width="w-[180px]"
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                options={agentSelectData.options}
                                optionGroups={agentSelectData.optionGroups}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                            {[
                                { label: 'Analyze some code', icon: faCode },
                                { label: 'Write a short story', icon: faBookOpen },
                                { label: 'Help me research', icon: faMagnifyingGlass },
                                { label: 'Explain a concept', icon: faLightbulb },
                            ].map(({ label, icon }) => (
                                <Button key={label} icon={icon} onClick={() => setInputText(label)}>{label}</Button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.role === 'reasoning' && !config?.chat.showReasoning) return null;
                    if (msg.role === 'system' || msg.role === 'tool') return null;

                    if (msg.role === 'user') {
                        return (
                            <UserChatBubble
                                key={i}
                                message={msg}
                                formatTimestamp={formatTimestamp}
                            />
                        );
                    }

                    if (msg.role === 'assistant') {
                        const hasTools = msg.tool_calls?.length > 0;
                        const hasContent = !!msg.content?.trim();
                        if (!hasTools && !hasContent) return null;
                        return (
                            <Fragment key={i}>
                                {hasTools && <ToolActivityRows tool_calls={msg.tool_calls} />}
                                {hasContent && (
                                    <AgentChatBubble
                                        message={{ ...msg, tool_calls: undefined }}
                                        agent={currentAgent}
                                        formatTimestamp={formatTimestamp}
                                        showTokenMetrics={config?.chat.showTokenMetrics}
                                    />
                                )}
                            </Fragment>
                        );
                    }

                    return (
                        <AgentChatBubble
                            key={i}
                            message={msg}
                            agent={currentAgent}
                            formatTimestamp={formatTimestamp}
                            showTokenMetrics={config?.chat.showTokenMetrics}
                        />
                    );
                })}
                {isStreaming && activeTool && (
                    <ActiveToolBubble activeTool={activeTool} />
                )}
                {isStreaming && !activeTool && (
                    <StreamingChatBubble agent={currentAgent} />
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Section */}
            <div className="p-6 lg:px-12 pt-6">

                {(askUserQuestion || (askUserOptions && askUserOptions.length > 0)) && (
                    <div className="max-w-4xl mx-auto mb-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                        {askUserQuestion && (
                            <p className="text-sm text-center text-secondary px-4">{askUserQuestion}</p>
                        )}
                        <div className="flex flex-wrap gap-2 justify-center">
                        {askUserOptions && askUserOptions.map((opt, idx) => (
                            <Button
                                key={idx}
                                themed={true}
                                className="!rounded-full px-6 shadow-md hover:scale-105 transition-transform"
                                onClick={() => {
                                    setInputText(opt);
                                }}
                            >
                                {opt}
                            </Button>
                        ))}
                        </div>
                    </div>
                )}

                {isAgentMissing && (
                    <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center justify-center gap-2">
                        <AlertCircle size={16} />
                        <span>You cannot send a message to this agent because it no longer exists.</span>
                    </div>
                )}
                {contextWarning && (
                    <div className="max-w-4xl mx-auto mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{contextWarning}</span>
                    </div>
                )}
                <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
                    <TextArea
                        ref={textareaRef}
                        className={`rounded-3xl pr-14`}
                        placeholder={isAgentMissing ? "Agent not found" : isNoAgentSelected ? "Select an agent to start chatting..." : isGatewayConnected ? `Message ${currentAgent?.name}...` : "Gateway Offline - Check Settings"}
                        rows={1}
                        currentText={inputText}
                        disabled={!isGatewayConnected || isAgentMissing || isNoAgentSelected}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <Button
                        themed={!isStreaming && inputText.trim().length > 0 && isGatewayConnected && !isAgentMissing && !isNoAgentSelected}
                        className={`absolute right-2 bottom-3.5 !w-10 !h-10 !rounded-full ${isStreaming ? '!bg-red-200 dark:!bg-red-900/40 !text-red-700 dark:!text-red-400 disabled:!opacity-100' : ''
                            }`}
                        disabled={(!isStreaming && !inputText.trim()) || !isGatewayConnected || isAgentMissing || isNoAgentSelected}
                        onClick={isStreaming ? handleStop : handleSend}
                        icon={isStreaming ? faSquare : faPaperPlane}
                    />
                </form>
                <div className="mt-2 text-center flex items-center justify-center gap-1">
                    <Text secondary={true} size="sm">Press</Text>
                    <Badge><Text secondary={true} size="xs" bold={true}>Enter</Text></Badge>
                    <Text secondary={true} size="sm">to send,</Text>
                    <Badge><Text secondary={true} size="xs" bold={true}>Shift + Enter</Text></Badge>
                    <Text secondary={true} size="sm">for a new line</Text>
                </div>
            </div>
        </div>
    )
}
