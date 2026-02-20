import React from 'react'
import {
    BrainCircuit,
    Bot,
    Loader2,
    AlertCircle
} from 'lucide-react'
import {
    faPaperPlane
} from '@fortawesome/free-solid-svg-icons'
import Button from '../Button'
import Select from '../Select'
import { Message, Agent } from '../../types'
import { AgentChatBubble, UserChatBubble, StreamingChatBubble } from '../ChatBubble'
import Text from '../Text'
import Badge from '../Badge'

interface Config {

    chat: {
        showReasoning: boolean;
        includeHistory: boolean;
        generateSummaries: boolean;
    };
    gateway: {
        port: number;
    };
    global?: {
        systemPrompt: string;
    };
    providers: {
        description: string;
        endpoint: string;
        model: string;
    }[];
}

interface ChatPageProps {
    agents: Agent[];
    selectedAgentId: string;
    setSelectedAgentId: (id: string) => void;
    messages: Message[];
    config: Config | null;
    isStreaming: boolean;
    inputText: string;
    setInputText: (text: string) => void;
    handleSend: (e: React.FormEvent) => Promise<void>;
    isGatewayConnected: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    chatContainerRef: React.RefObject<HTMLDivElement | null>;
    handleScroll: () => void;
    formatTimestamp: (timestamp?: number) => string;
}

export default function ChatPage({
    agents,
    selectedAgentId,
    setSelectedAgentId,
    messages,
    config,
    isStreaming,
    inputText,
    setInputText,
    handleSend,
    isGatewayConnected,
    messagesEndRef,
    textareaRef,
    chatContainerRef,
    handleScroll,
    formatTimestamp
}: ChatPageProps) {

    const currentAgent = agents.find(a => a.id === selectedAgentId);
    const isNoAgentSelected = !selectedAgentId;
    const isAgentMissing = !currentAgent && !!selectedAgentId;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Agent ToolBar */}
            <div className="px-6 py-4 border-b border-border-color flex justify-between items-center bg-bg-primary/80 backdrop-blur-md sticky top-0 z-20">
                {isAgentMissing ? (
                    <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xl">
                            <AlertCircle size={18} className="text-neutral-500" />
                        </div>
                        <div className="text-sm font-bold text-neutral-500">
                            Agent Deleted
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-accent-primary flex items-center justify-center text-xl">
                            {currentAgent?.emoji || <BrainCircuit size={18} className="text-white" />}
                        </div>
                        <div>
                            <Select
                                value={selectedAgentId}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAgentId(e.target.value)}
                                options={[
                                    { value: '', label: 'Choose an Agent' },
                                    ...agents.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))
                                ]}
                            />
                            {currentAgent && (
                                <div className="flex items-center gap-1.5 mt-.5 ml-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <Text size="sm" bold={true} className="uppercase tracking-wide opacity-60">Ready to assist</Text>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-12 py-8 space-y-6"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-24 h-24 bg-bg-card border border-border-color rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm animate-bounce-slow">
                            <Text>
                                {currentAgent?.emoji || <Bot size={40} />}
                            </Text>
                        </div>
                        <Text size="3xl" bold={true}>Chat with {currentAgent?.name}</Text>
                        <Text className="max-w-sm" size="md">Your personal AI assistant powered by local inference. Send a message to get started.</Text>

                        <div className="grid grid-cols-2 gap-3 mt-10 max-w-lg w-full">
                            {['Analyze some code', 'Write a short story', 'Help me research', 'Explain a concept'].map(hint => (
                                <Button key={hint} onClick={() => setInputText(hint)}>{hint}</Button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.role === 'reasoning' && !config?.chat.showReasoning) return null;
                    if (msg.role === 'system') return null;

                    if (msg.role === 'user') {
                        return (
                            <UserChatBubble
                                key={i}
                                message={msg}
                                formatTimestamp={formatTimestamp}
                            />
                        );
                    }

                    return (
                        <AgentChatBubble
                            key={i}
                            message={msg}
                            agent={currentAgent}
                            formatTimestamp={formatTimestamp}
                        />
                    );
                })}
                {isStreaming && (
                    <StreamingChatBubble agent={currentAgent} />
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Section */}
            <div className="p-6 lg:px-12 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent pt-10">
                {isAgentMissing && (
                    <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center justify-center gap-2">
                        <AlertCircle size={16} />
                        <span>You cannot send a message to this agent because it no longer exists.</span>
                    </div>
                )}
                <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-2 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-white rounded-3xl py-4 pl-6 pr-14 outline-none hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-accent-primary transition-all scrollbar-none resize-none text-base leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={isAgentMissing ? "Agent not found" : isNoAgentSelected ? "Select an agent to start chatting..." : isGatewayConnected ? `Message ${currentAgent?.name}...` : "Gateway Offline - Check Settings"}
                        rows={1}
                        value={inputText}
                        disabled={!isGatewayConnected || isAgentMissing || isNoAgentSelected}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputText(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <Button
                        themed={!isStreaming && inputText.trim().length > 0 && isGatewayConnected && !isAgentMissing && !isNoAgentSelected}
                        className={`absolute right-2 bottom-3.5 !w-10 !h-10 !rounded-full`}
                        disabled={isStreaming || !inputText.trim() || !isGatewayConnected || isAgentMissing || isNoAgentSelected}
                        onClick={handleSend}
                        icon={isStreaming ? undefined : faPaperPlane}
                    >
                        {isStreaming && <Loader2 size={18} className="animate-spin" />}
                    </Button>
                </form>
                <div className="mt-2 text-xs text-center flex items-center justify-center gap-1">
                    <Text secondary={true} size="xs">Press</Text>
                    <Badge><Text secondary={true} size="xs" bold={true}>Enter</Text></Badge>
                    <Text secondary={true} size="xs">to send,</Text>
                    <Badge><Text secondary={true} size="xs" bold={true}>Shift + Enter</Text></Badge>
                    <Text secondary={true} size="xs">for a new line</Text>
                </div>
            </div>
        </div>
    )
}
