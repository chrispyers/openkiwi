import { useRef, useEffect } from 'react'
import {
    BrainCircuit,
    Bot,
    User,
    Loader2
} from 'lucide-react'
import {
    faRobot,
    faPaperPlane
} from '@fortawesome/free-solid-svg-icons'
import Button from '../Button'
import Select from '../Select'
import MarkdownRenderer from '../MarkdownRenderer'

// Re-defining interfaces here since we don't have a shared types file yet
interface Message {
    role: 'user' | 'assistant' | 'reasoning' | 'system';
    content: string;
    timestamp?: number;
}

interface Agent {
    id: string;
    name: string;
    emoji: string;
    path: string;
    identity: string;
    soul: string;
    systemPrompt: string;
}

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

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Agent ToolBar */}
            <div className="px-6 py-4 border-b border-border-color flex justify-between items-center bg-bg-primary/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-primary flex items-center justify-center text-xl shadow-[0_4px_15px_rgba(99,102,241,0.3)]">
                        {agents.find(a => a.id === selectedAgentId)?.emoji || <BrainCircuit size={18} className="text-white" />}
                    </div>
                    <div>
                        <div className="font-semibold text-neutral-600 dark:text-white text-sm leading-tight">{agents.find(a => a.id === selectedAgentId)?.name || 'Select Agent'}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                            <span className="text-xs uppercase font-bold tracking-wider">Ready to assist</span>
                        </div>
                    </div>
                </div>
                <Select
                    className="!py-1.5 !text-xs !rounded-lg"
                    width="w-48"
                    icon={faRobot}
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    options={agents.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))}
                />
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
                            {agents.find(a => a.id === selectedAgentId)?.emoji || <Bot size={40} className="text-accent-primary" />}
                        </div>
                        <h2 className="text-3xl font-bold text-neutral-600 dark:text-white mb-2 tracking-tight">Chat with {agents.find(a => a.id === selectedAgentId)?.name}</h2>
                        <p className="max-w-sm leading-relaxed">Your personal AI assistant powered by local inference. Send a message to get started.</p>

                        <div className="grid grid-cols-2 gap-3 mt-10 max-w-lg w-full">
                            {['Analyze some code', 'Write a short story', 'Help me research', 'Explain a concept'].map(hint => (
                                <button
                                    key={hint}
                                    className="p-4 bg-white-trans border border-white-trans rounded-2xl text-left text-sm hover:bg-accent-primary/5 hover:border-accent-primary/20 transition-all active:scale-95"
                                    onClick={() => setInputText(hint)}
                                >
                                    {hint}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.role === 'reasoning' && !config?.chat.showReasoning) return null;
                    if (msg.role === 'system') return null;
                    return (
                        <div key={i} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`flex gap-4 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${msg.role === 'user' ? 'bg-bg-card text-neutral-600 dark:text-white' : msg.role === 'reasoning' ? 'bg-amber-500/10 text-amber-500' : 'bg-accent-primary text-white'} shadow-sm`}>
                                        {msg.role === 'user' ? <User size={18} /> : msg.role === 'reasoning' ? <BrainCircuit size={16} /> : (
                                            <span>{agents.find(a => a.id === selectedAgentId)?.emoji || '🤖'}</span>
                                        )}
                                    </div>
                                    <div className={`bubble ${msg.role === 'user' ? 'user-bubble' : msg.role === 'reasoning' ? 'reasoning-bubble' : 'ai-bubble'}`}>
                                        {msg.role === 'reasoning' && (
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10 text-xs font-bold uppercase tracking-widest text-amber-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                Thought Process
                                            </div>
                                        )}
                                        <div className="w-full">
                                            <MarkdownRenderer
                                                content={msg.content}
                                                className={msg.role === 'user' ? 'prose-invert prose-chat' : 'prose dark:prose-invert prose-chat'}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {msg.timestamp && (
                                    <div className={`mt-2 text-xs font-medium flex items-center gap-1.5 px-1 ${msg.role === 'user' ? '' : 'ml-12'}`}>
                                        {formatTimestamp(msg.timestamp)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
                {isStreaming && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <div className="flex gap-4 items-start">
                            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-accent-primary flex items-center justify-center text-lg text-white shadow-sm">
                                <span>{agents.find(a => a.id === selectedAgentId)?.emoji || '🤖'}</span>
                            </div>
                            <div className="loading-dots">
                                <span className="dot" />
                                <span className="dot" />
                                <span className="dot" />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Section */}
            <div className="p-6 lg:px-12 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent pt-10">
                <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-2 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-white rounded-3xl py-4 pl-6 pr-14 outline-none hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-accent-primary transition-all scrollbar-none resize-none text-base leading-relaxed"
                        placeholder={isGatewayConnected ? `Message ${agents.find(a => a.id === selectedAgentId)?.name}...` : "Gateway Offline - Check Settings"}
                        rows={1}
                        value={inputText}
                        disabled={!isGatewayConnected}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <Button
                        themed={!isStreaming && inputText.trim().length > 0 && isGatewayConnected}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 !w-10 !h-10 !rounded-full flex items-center justify-center`}
                        disabled={isStreaming || !inputText.trim() || !isGatewayConnected}
                        onClick={handleSend}
                        icon={isStreaming ? undefined : faPaperPlane}
                    >
                        {isStreaming && <Loader2 size={18} className="animate-spin" />}
                    </Button>
                </form>
                <div className="mt-2 text-xs text-center flex items-center justify-center gap-1">
                    Press <span className="px-1.5 py-0.5 bg-white-trans rounded mx-1 text-neutral-600 dark:text-white">Enter</span> to send, <span className="px-1.5 py-0.5 bg-white-trans rounded mx-1 text-neutral-600 dark:text-white">Shift + Enter</span> for new line
                </div>
            </div>
        </div>
    )
}
