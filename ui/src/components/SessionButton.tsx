import React from 'react';
import Button from './Button';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import DeleteButton from './DeleteButton';
import { Session, Agent } from '../types';
import Text from './Text';

interface SessionButtonProps {
    session: Session;
    isActive: boolean;
    agent?: Agent;
    onLoadSession: (session: Session) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    formatTimestamp: (timestamp?: number) => string;
}

export const SessionButton: React.FC<SessionButtonProps> = ({
    session,
    isActive,
    agent,
    onLoadSession,
    onDeleteSession,
    formatTimestamp
}) => {
    return (
        <div
            className={`group w-full p-2 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-100 ${isActive ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-white' : ' hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:text-white'}`}
            onClick={() => onLoadSession(session)}
        >
            {/* <div className="text-xl flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white-trans rounded-lg">
                {agent?.emoji || '💬'}
            </div> */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <Text className="text-sm font-medium truncate text-neutral-500 dark:text-neutral-300">
                    {session.summary || session.title}
                </Text>
                <Text className="text-xs text-neutral-400 dark:text-neutral-400 truncate">
                    {formatTimestamp(session.updatedAt)}
                </Text>
            </div>
            <DeleteButton
                onClick={(e) => onDeleteSession(session.id, e)}
            />
        </div>
    );
};

export default SessionButton;
