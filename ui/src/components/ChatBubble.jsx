import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faArrowUp, faArrowDown, faUser, faEye, faEyeSlash, faWrench, faBoltLightning } from '@fortawesome/free-solid-svg-icons';
import MarkdownRenderer from './MarkdownRenderer';
import Text from './Text';
import Badge from './Badge';
import { AlertCircle } from 'lucide-react';
import AgentAvatar from './AgentAvatar';

export const ChatBubble = ({
    role,
    content,
    timestamp,
    formatTimestamp,
    avatar,
    isUser = false,
    isReasoning = false,
    className = "",
    stats,
    showTokenMetrics = true,
    tool_calls,
    isError = false
}) => {
    const [isVisible, setIsVisible] = React.useState(!isReasoning);

    return (
        <div className={`flex w-full group ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex flex-col ${isUser ? 'max-w-[85%] items-end' : 'max-w-[95%] items-start'}`}>
                <div className={`flex gap-4 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${isUser ? 'bg-neutral-200 dark:bg-neutral-700' : isReasoning ? 'bg-violet-500/10 text-violet-500' : 'bg-neutral-200 dark:bg-neutral-700 text-primary'} shadow-sm`}>
                        <Text>
                            {avatar}
                        </Text>
                    </div>
                    <div className={`bubble ${className} ${isError ? '!border-red-500/30 !bg-red-500/5' : ''}`}>
                        {isError && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-bold uppercase tracking-widest mb-2 border-b border-red-500/10 pb-2">
                                <AlertCircle size={14} />
                                System Error
                            </div>
                        )}
                        {isReasoning && (
                            <div className={`flex items-center justify-between gap-2 ${isVisible ? 'mb-2 pb-2 border-b border-violet-500/10' : ''} text-xs font-bold uppercase tracking-widest text-violet-500`}>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                                    Thought Process
                                </div>
                                <button
                                    onClick={() => setIsVisible(!isVisible)}
                                    className="hover:text-violet-400 transition-colors p-1"
                                    title={isVisible ? "Hide Thought Process" : "Show Thought Process"}
                                >
                                    <FontAwesomeIcon icon={isVisible ? faEye : faEyeSlash} />
                                </button>
                            </div>
                        )}
                        {(!isReasoning || isVisible) && (
                            <>
                                <div className="w-full">
                                    <MarkdownRenderer
                                        content={content}
                                        className={isUser ? 'prose-invert whitespace-pre-wrap' : ''}
                                        breaks={!isUser}
                                    />
                                </div>
                                {tool_calls && tool_calls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-500/10">
                                        {tool_calls.map((tc, idx) => (
                                            <Badge key={idx}>
                                                {tc.pluginType === 'tool' ? (
                                                    <FontAwesomeIcon icon={faWrench} className="w-3 h-3 mr-1" />
                                                ) : tc.pluginType === 'skill' && (tc.displayName || tc.function?.name || tc.name)?.toLowerCase().includes('memory') ? (
                                                    <FontAwesomeIcon icon={faBrain} className="w-3 h-3 mr-1" />
                                                ) : tc.pluginType === 'skill' ? (
                                                    <FontAwesomeIcon icon={faBoltLightning} className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <><FontAwesomeIcon icon={faBoltLightning} className="w-3 h-3 mr-1" />{tc.pluginType}</>
                                                )}
                                                {tc.displayName || tc.function?.name || tc.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {showTokenMetrics && stats && stats.tps !== undefined && stats.tps > 0 && (
                                    <div className="text-secondary flex items-center gap-3 mt-3 pt-2 border-t border-neutral-500/10 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                        <span className="flex items-center gap-1">
                                            {stats.tps} <span className="opacity-50">TPS</span>
                                        </span>
                                        <span className="mx-1 opacity-20">|</span>
                                        <span className="flex items-center gap-1">
                                            TOKENS:
                                            <span className="flex items-center gap-0.5 ml-1">
                                                <FontAwesomeIcon icon={faArrowUp} />
                                                {stats.inputTokens ?? 0}
                                            </span>
                                            <span className="mx-1 opacity-30">|</span>
                                            <span className="flex items-center gap-0.5">
                                                <FontAwesomeIcon icon={faArrowDown} />
                                                {stats.outputTokens ?? stats.tokens ?? 0}
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
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
}) => (
    <ChatBubble
        role={message.role}
        content={message.content}
        timestamp={message.timestamp}
        formatTimestamp={formatTimestamp}
        isUser={true}
        avatar={<FontAwesomeIcon icon={faUser} />}
        className="user-bubble"
    />
);

export const AgentChatBubble = ({
    message,
    agent,
    formatTimestamp,
    showTokenMetrics
}) => {
    const isReasoning = message.role === 'reasoning';
    return (
        <ChatBubble
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            formatTimestamp={formatTimestamp}
            isReasoning={isReasoning}
            avatar={isReasoning ? <FontAwesomeIcon icon={faBrain} style={{ fontSize: '14px' }} /> : <AgentAvatar agent={agent} size="sm" className="!bg-transparent" />}
            className={isReasoning ? 'reasoning-bubble' : 'ai-bubble'}
            stats={message.stats}
            showTokenMetrics={showTokenMetrics}
            tool_calls={message.tool_calls}
            isError={message.isError}
        />
    );
};

export const StreamingChatBubble = ({ agent }) => (
    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex gap-4 items-start">
            <AgentAvatar agent={agent} size="sm" />
            <div className="loading-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
            </div>
        </div>
    </div>
);
