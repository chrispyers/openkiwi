import React from 'react';
import Text from './Text';
import Badge from './Badge';
import { Agent } from '../types';
import AgentAvatar from './AgentAvatar';

interface AgentState {
    status: string;
    details?: string;
}

interface AgentActivityBlockProps {
    agent: Agent;
    state: AgentState;
}

const AgentActivityBlock: React.FC<AgentActivityBlockProps> = ({ agent, state }) => {
    const isIdle = state.status === 'idle';

    return (
        <div className={`bg-surface rounded-2xl flex items-center transition-all ${isIdle ? 'w-fit p-2 gap-4' : 'w-full p-6 justify-between'}`}>


            <div className="">
                {isIdle && (
                    <>
                        <Badge size="md">idle</Badge>
                        {/* <Badge size="md"><FontAwesomeIcon icon={faCircleCheck} className="text-neutral-400" /></Badge> */}
                    </>
                )}
            </div>


            <div className="flex items-center gap-2">
                {
                    agent && <AgentAvatar agent={agent} size="md" className="!bg-transparent" />
                }
                <div className="flex flex-col">
                    <Text size="lg" bold={true}>{agent.name}</Text>
                </div>
            </div>
            <div className="flex flex-col items-end text-right">
                <div className="flex items-center gap-2 mb-1">
                    {!isIdle && (
                        <div className="relative flex h-3 w-3 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-primary"></span>
                        </div>
                    )}
                    {isIdle && (
                        <>
                            {/* <Badge size="md">idle</Badge> */}
                            {/* <FontAwesomeIcon icon={faHourglassEnd} className="text-neutral-400" /> */}
                            {/* <FontAwesomeIcon icon={faCircleCheck} className="text-neutral-400" /> */}
                        </>
                    )}
                    <Text bold={true} className={isIdle ? 'text-neutral-400' : 'text-accent-primary'}>
                        {isIdle ? '' : state.status.toUpperCase()}
                    </Text>
                </div>
                {!isIdle && state.details && (
                    <Text secondary={true} size="sm" className="opacity-80 max-w-md truncate">
                        {state.details}
                    </Text>
                )}
            </div>
        </div>
    );
};

export default AgentActivityBlock;
