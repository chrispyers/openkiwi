import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Session, Agent } from '../types';
import SessionButton from './SessionButton';
import Text from './Text';

interface SessionGroupProps {
    agent: Agent;
    sessions: Session[];
    activeSessionId: string | null;
    onLoadSession: (session: Session) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    formatTimestamp: (timestamp?: number) => string;
}

export const SessionGroup: React.FC<SessionGroupProps> = ({
    agent,
    sessions,
    activeSessionId,
    onLoadSession,
    onDeleteSession,
    formatTimestamp
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (sessions.length === 0) return null;

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="flex items-center gap-1.5">
                    <Text size="xs">{agent.emoji}</Text>
                    <Text size="xs" bold={true}>{agent.name}</Text>
                    <span className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300 px-1.5 py-0.5 rounded text-[10px]">
                        <Text size="xs" bold={true}>{sessions.length}</Text>
                    </span>
                </span>
            </button>

            {isExpanded && (
                <div className="space-y-1 mt-1 pl-2 border-l border-neutral-300 dark:border-neutral-700 ml-1.5">
                    {sessions.map(session => (
                        <SessionButton
                            key={session.id}
                            session={session}
                            isActive={activeSessionId === session.id}
                            agent={agent}
                            onLoadSession={onLoadSession}
                            onDeleteSession={onDeleteSession}
                            formatTimestamp={formatTimestamp}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SessionGroup;
