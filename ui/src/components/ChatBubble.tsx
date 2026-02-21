import React from 'react';
import { User, Bot, BrainCircuit } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { Message, Agent } from '../types';
import Text from './Text';

interface ChatBubbleProps {
    role: 'user' | 'assistant' | 'reasoning' | 'system';
    content: string;
    timestamp?: number;
    formatTimestamp: (timestamp?: number) => string;
    avatar: React.ReactNode;
    isUser?: boolean;
    isReasoning?: boolean;
    className?: string; // For the bubble itself
}

export const ChatBubble = ({
    role,
    content,
    timestamp,
    formatTimestamp,
    avatar,
    isUser = false,
    isReasoning = false,
    className = ""
}: ChatBubbleProps) => {
    return (
        <div className={`flex w-full group ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`flex gap-4 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${isUser ? 'bg-neutral-100 dark:bg-neutral-800' : isReasoning ? 'bg-amber-500/10 text-amber-500' : 'bg-neutral-200/50 dark:bg-neutral-800 text-white'} shadow-sm`}>
                        <Text>
                            {avatar}
                        </Text>
                    </div>
                    <div className={`bubble ${className}`}>
                        {isReasoning && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10 text-xs font-bold uppercase tracking-widest text-amber-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Thought Process
                            </div>
                        )}
                        <div className="w-full">
                            <MarkdownRenderer
                                content={content}
                                className={isUser ? 'prose-invert whitespace-pre-wrap' : ''}
                                breaks={!isUser}
                            />
                        </div>
                    </div>
                </div>
                {timestamp && (
                    <div className={`mt-2 flex items-center gap-1.5 px-1 ${isUser ? '' : 'ml-12'}`}>
                        <Text size="xs" secondary={true} bold={true}>
                            {formatTimestamp(timestamp)}
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
};

export const UserChatBubble = ({
    message,
    formatTimestamp
}: {
    message: Message,
    formatTimestamp: (t?: number) => string
}) => (
    <ChatBubble
        role={message.role}
        content={message.content}
        timestamp={message.timestamp}
        formatTimestamp={formatTimestamp}
        isUser={true}
        avatar={<User size={18} />}
        className="user-bubble"
    />
);

export const AgentChatBubble = ({
    message,
    agent,
    formatTimestamp
}: {
    message: Message,
    agent?: Agent,
    formatTimestamp: (t?: number) => string
}) => {
    const isReasoning = message.role === 'reasoning';
    return (
        <ChatBubble
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            formatTimestamp={formatTimestamp}
            isReasoning={isReasoning}
            avatar={isReasoning ? <BrainCircuit size={16} /> : (agent?.emoji ? <span>{agent.emoji}</span> : <Bot size={18} />)}
            className={isReasoning ? 'reasoning-bubble' : 'ai-bubble'}
        />
    );
};

export const StreamingChatBubble = ({ agent }: { agent?: Agent }) => (
    <div className="flex justify-start animate-in fade-in duration-300">
        <div className="flex gap-4 items-start">
            <div className="bg-neutral-100 dark:bg-neutral-800 w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg text-white shadow-sm">
                {agent?.emoji ? <span>{agent.emoji}</span> : <Bot size={18} />}
            </div>
            <div className="loading-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
            </div>
        </div>
    </div>
);
