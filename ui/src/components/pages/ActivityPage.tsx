import React, { useState, useEffect } from 'react';
import Page from './Page';
import Text from '../Text';
import Badge from '../Badge';
import { Agent, AgentState } from '../../types';
import AgentAvatar from '../AgentAvatar';

interface ActivityPageProps {
    agents: Agent[];
    agentStates: Record<string, AgentState>;
}

const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
};

const AgentActivityRow: React.FC<{ agent: Agent, state: AgentState }> = ({ agent, state }) => {
    const isIdle = state.status === 'idle';
    const isWaiting = state.status === 'waiting_for_user';
    const isWorking = !isIdle && !isWaiting;

    let containerClass = 'bg-surface/20';
    let avatarClass = 'grayscale !bg-neutral-500/10';
    let statusColor = 'text-neutral-500';
    let dotClass = 'bg-neutral-500/50';
    let statusText = 'Idle';

    if (isWaiting) {
        containerClass = 'bg-amber-500/10 border-l-4 border-l-amber-500';
        avatarClass = '!bg-amber-500/20 ring-2 ring-amber-500/50 animate-pulse';
        statusColor = 'text-amber-500';
        dotClass = 'bg-amber-500 animate-pulse';
        statusText = 'Waiting on You';
    } else if (isWorking) {
        containerClass = 'bg-emerald-500/10 border-l-4 border-l-emerald-500';
        avatarClass = '!bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
        statusColor = 'text-emerald-500';
        dotClass = 'bg-emerald-500 animate-pulse';
        statusText = state.status.charAt(0).toUpperCase() + state.status.slice(1);
    }

    return (
        <div className={`grid grid-cols-12 items-center ${containerClass} hover:bg-surface/40 border border-white/5 rounded-xl p-4 transition-all group`}>

            <div className="col-span-5 flex items-center gap-4 border-r border-white/5 pr-4">
                <AgentAvatar agent={agent} size="md" className={`!w-12 !h-12 ${avatarClass} rounded-full overflow-hidden shrink-0`} />
                <div className="flex flex-col overflow-hidden">
                    <Text bold className="transition-colors truncate">{agent.name}</Text>
                    {!isIdle && state.details && (
                        <Text size="xs" className={`${statusColor} truncate max-w-full italic`} title={state.details}>
                            {state.details}
                        </Text>
                    )}
                </div>
            </div>

            <div className="col-span-4 text-center border-r border-white/5">
                <Text secondary size="sm" className="opacity-60">{agent.provider || 'AI Assistant'}</Text>
            </div>

            <div className="col-span-3 flex items-center justify-end pr-4 gap-2">
                <span className={`w-2 h-2 rounded-full ${dotClass} shadow-lg`} />
                <Text className={statusColor} bold={!isIdle} size="sm">
                    {statusText}
                </Text>
            </div>
        </div>
    );
};

const ActivityPage: React.FC<ActivityPageProps> = ({ agents, agentStates }) => {
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const activeAgents = agents.filter(agent => (agentStates[agent.id]?.status || 'idle') !== 'idle');
    const idleAgents = agents.filter(agent => (agentStates[agent.id]?.status || 'idle') === 'idle');

    return (
        <Page
            title="Agent Activity Dashboard"
            subtitle="Real-time monitoring of current agent status and performance metrics."
        >
            <div className="flex flex-col gap-10 p-8 max-w-7xl mx-auto">
                {/* Active Agents Section */}
                {activeAgents.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                            <Text size="xl" bold>ACTIVE AGENTS</Text>
                            <Badge variant="success" size="sm" className="animate-pulse">LIVE</Badge>
                        </div>
                        <div className="flex flex-col gap-3">
                            {activeAgents.map(agent => (
                                <AgentActivityRow
                                    key={agent.id}
                                    agent={agent}
                                    state={agentStates[agent.id]}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Idle Agents Section */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                        <Text size="xl" bold className="opacity-60">IDLE AGENTS</Text>
                        <Badge size="sm">{idleAgents.length}</Badge>
                    </div>

                    <div className="flex flex-col gap-3">
                        {idleAgents.map(agent => (
                            <AgentActivityRow
                                key={agent.id}
                                agent={agent}
                                state={agentStates[agent.id] || { status: 'idle', since: Date.now() }}
                            />
                        ))}
                        {idleAgents.length === 0 && activeAgents.length === 0 && (
                            <div className="p-12 text-center bg-surface/10 rounded-2xl border border-dashed border-white/10">
                                <Text secondary>No agents found. Create one in the Agents tab.</Text>
                            </div>
                        )}
                        {idleAgents.length === 0 && activeAgents.length > 0 && (
                            <Text secondary size="sm" className="italic opacity-40">All agents are currently active.</Text>
                        )}
                    </div>
                </section>
            </div>
        </Page>
    );
};

export default ActivityPage;
