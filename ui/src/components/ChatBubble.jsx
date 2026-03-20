import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faArrowUp, faArrowDown, faUser, faEye, faEyeSlash, faWrench, faBoltLightning, faFolder, faPen, faTrash, faGlobe, faMagnifyingGlass, faTerminal, faFolderPlus, faArrowRight, faCopy, faCheck, faScroll } from '@fortawesome/free-solid-svg-icons';
import MarkdownRenderer from './MarkdownRenderer';
import Text from './Text';
import { AlertCircle } from 'lucide-react';
import AgentAvatar from './AgentAvatar';

const getBasename = (filePath) => {
    if (!filePath) return '';
    const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 2) return filePath;
    return '…/' + parts.slice(-2).join('/');
};

const getToolAction = (name, argsStr, displayName) => {
    try {
        const args = JSON.parse(argsStr || '{}');
        if (name === 'file_manager') {
            const p = getBasename(args.path);
            switch (args.action) {
                case 'delete': return { icon: faTrash,      label: `Deleting ${p}` };
                case 'mkdir':  return { icon: faFolderPlus, label: `Creating directory ${p}` };
                case 'move':   return { icon: faArrowRight, label: `Moving ${p}` };
                case 'copy':   return { icon: faCopy,       label: `Copying ${p}` };
                default:       return { icon: faWrench,     label: displayName || name };
            }
        }
        switch (name) {
            // Core tools
            case 'write':          return { icon: faPen,             label: `Writing ${getBasename(args.path)}` };
            case 'read':           return { icon: faEye,             label: `Reading ${getBasename(args.path)}` };
            case 'edit':           return { icon: faPen,             label: `Editing ${getBasename(args.path)}` };
            case 'ls':             return { icon: faFolder,          label: `Listing ${getBasename(args.path) || 'workspace'}` };
            case 'bash':           return { icon: faTerminal,        label: `Running: ${(args.command || '').slice(0, 60)}` };
            case 'grep':           return { icon: faMagnifyingGlass, label: `Searching for "${args.pattern || ''}"` };
            case 'glob':           return { icon: faMagnifyingGlass, label: `Globbing "${args.pattern || ''}"` };
            case 'web_fetch':      return { icon: faGlobe,           label: `Fetching ${args.url || ''}` };
            case 'web_search':     return { icon: faMagnifyingGlass, label: `Searching "${args.query || ''}"` };
            // Legacy / other tools
            case 'chromium':       return { icon: faGlobe,           label: `Browsing ${args.url || ''}` };
            case 'google_search':  return { icon: faMagnifyingGlass, label: `Searching "${args.query || ''}"` };
            case 'terminal':       return { icon: faTerminal,        label: `Running: ${(args.command || '').slice(0, 60)}` };
            case 'execute_workflow': return { icon: faScroll,         label: displayName || 'Workflows: Execute' };
            case 'list_workflows':   return { icon: faScroll,         label: displayName || 'Workflows: List' };
            case 'memory_search':  return { icon: faBrain,           label: `Searching memory for "${args.query || ''}"` };
            case 'memory_store':   return { icon: faBrain,           label: `Storing memory` };
            case 'read_file':      return { icon: faEye,             label: `Reading ${getBasename(args.path)}` };
            case 'write_file':     return { icon: faPen,             label: `Writing ${getBasename(args.path)}` };
            case 'list_directory': return { icon: faFolder,          label: `Listing ${getBasename(args.path)}` };
            default:               return { icon: faBoltLightning,   label: displayName || name };
        }
    } catch {
        return { icon: faWrench, label: displayName || name };
    }
};

const ElapsedTimer = ({ startedAt }) => {
    const [elapsed, setElapsed] = useState(Math.floor((Date.now() - startedAt) / 1000));
    useEffect(() => {
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
        return () => clearInterval(id);
    }, [startedAt]);
    return <span>{elapsed}s</span>;
};

const ToolCallTimeline = ({ tool_calls }) => {
    if (!tool_calls || tool_calls.length === 0) return null;
    return (
        <div className="flex flex-col mt-3 pt-3 border-t border-neutral-500/10">
            {tool_calls.map((tc, idx) => {
                const name = tc.function?.name || tc.name || '';
                const { icon, label } = getToolAction(name, tc.function?.arguments, tc.displayName);
                const duration = tc.durationMs != null
                    ? (tc.durationMs < 1000 ? `${tc.durationMs}ms` : `${(tc.durationMs / 1000).toFixed(1)}s`)
                    : null;
                return (
                    <div key={idx} className="flex items-center gap-2 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <FontAwesomeIcon icon={faCheck} className="w-3 h-3 flex-shrink-0 text-green-500" />
                        <FontAwesomeIcon icon={icon} className="w-3 h-3 flex-shrink-0 opacity-60" />
                        <span className="font-mono truncate flex-1">{label}</span>
                        {duration && <span className="opacity-50 shrink-0">{duration}</span>}
                    </div>
                );
            })}
        </div>
    );
};

export const ToolActivityRows = ({ tool_calls }) => {
    if (!tool_calls || tool_calls.length === 0) return null;
    return (
        <div className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {tool_calls.map((tc, idx) => {
                const name = tc.function?.name || tc.name || '';
                const { icon, label } = getToolAction(name, tc.function?.arguments, tc.displayName);
                const duration = tc.durationMs != null
                    ? (tc.durationMs < 1000 ? `${tc.durationMs}ms` : `${(tc.durationMs / 1000).toFixed(1)}s`)
                    : null;
                return (
                    <div key={idx}>
                        <div className="flex items-center gap-2 py-1 px-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 flex-shrink-0 text-green-500" />
                            <FontAwesomeIcon icon={icon} className="w-3 h-3 flex-shrink-0 opacity-60" />
                            <span className="font-mono">{label}</span>
                            {duration && <span className="opacity-50 ml-auto shrink-0">{duration}</span>}
                        </div>
                        {tc.workflowSteps && tc.workflowSteps.map((s, si) => (
                            <div key={si} className="flex items-center gap-2 py-0.5 pl-8 text-xs text-neutral-400 dark:text-neutral-500">
                                <FontAwesomeIcon icon={faScroll} className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                                <span className="font-mono opacity-70">Step {s.step}/{s.total}:</span>
                                <span className="font-mono">{s.stepName}</span>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export const ActiveToolBubble = ({ activeTool }) => {
    const name = activeTool.function?.name || activeTool.name || '';
    const { icon, label } = getToolAction(name, activeTool.function?.arguments, activeTool.displayName);
    const wp = activeTool.workflowProgress;
    return (
        <div className="flex items-center gap-2 py-1 px-1 text-xs text-neutral-500 dark:text-neutral-400 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse flex-shrink-0" />
            <FontAwesomeIcon icon={icon} className="w-3 h-3 flex-shrink-0 opacity-60" />
            {wp
                ? <span className="font-mono">{label} <span className="opacity-60">— step {wp.step}/{wp.total}:</span> {wp.stepName}</span>
                : <span className="font-mono">{label}</span>
            }
            <span className="opacity-50">· <ElapsedTimer startedAt={activeTool.startedAt} /></span>
        </div>
    );
};

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
                    <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${isUser ? 'bg-neutral-200 dark:bg-neutral-700 shadow-sm' : isReasoning ? 'bg-violet-500/10 text-violet-500 shadow-sm' : ''}`}>
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
                                    {isUser ? (
                                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed select-text">{content}</div>
                                    ) : (
                                        <MarkdownRenderer
                                            content={content}
                                            breaks={true}
                                        />
                                    )}
                                </div>
                                <ToolCallTimeline tool_calls={tool_calls} />
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
            avatar={isReasoning ? <FontAwesomeIcon icon={faBrain} style={{ fontSize: '14px' }} /> : <AgentAvatar agent={agent} size="md" />}
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
            <AgentAvatar agent={agent} size="md" />
            <div className="loading-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
            </div>
        </div>
    </div>
);
