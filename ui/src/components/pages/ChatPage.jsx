import React, { useEffect } from 'react'
import {
    AlertCircle
} from 'lucide-react'
import {
    faPaperPlane,
    faSquare
} from '@fortawesome/free-solid-svg-icons'
import Button from '../Button'
import Select from '../Select'
import { AgentChatBubble, UserChatBubble, StreamingChatBubble } from '../ChatBubble'
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
    inputText,
    setInputText,
    handleSend,
    handleStop,
    isGatewayConnected,
    messagesEndRef,
    textareaRef,
    chatContainerRef,
    handleScroll,
    formatTimestamp
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
                        <AgentAvatar agent={currentAgent} />
                        <div>
                            <Select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                options={[
                                    { value: '', label: 'Choose an Agent' },
                                    ...agents.map(a => ({ value: a.id, label: `${a.name}` }))
                                ]}
                            />
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
                        <AgentAvatar agent={currentAgent} size="xl" className="mb-6 animate-bounce-slow" />
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
                {isStreaming && (
                    <StreamingChatBubble agent={currentAgent} />
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Section */}
            <div className="p-6 lg:px-12  pt-10">
                {isAgentMissing && (
                    <div className="max-w-4xl mx-auto mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center justify-center gap-2">
                        <AlertCircle size={16} />
                        <span>You cannot send a message to this agent because it no longer exists.</span>
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
