import React from 'react';
import Button from './Button';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import DeleteButton from './DeleteButton';
import Text from './Text';
import Tooltip from './Tooltip';

export const SessionButton = ({
    session,
    isActive,
    agent,
    onLoadSession,
    onDeleteSession,
    formatTimestamp
}) => {
    return (
        <Tooltip content={session.summary || session.title} title="Summary" position="right" className="w-full">
            <div
                className={`group w-full pt-3 pb-3 pl-4 pr-2 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-100 ${isActive ? 'bg-[var(--agent-chat-bubble-bg)] shadow-sm' : 'hover:bg-[var(--agent-chat-bubble-bg)]'} text-primary`}
                onClick={() => onLoadSession(session)}
            >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
                    <Text className="text-sm font-medium truncate">
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
        </Tooltip>
    );
};

export default SessionButton;
