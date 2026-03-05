const getInitials = (name) => {
    if (!name) return "AI";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
};

const AgentAvatar = ({ agent, size = 'md', className = '', fallbackToInitials = true }) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-lg',
        md: 'w-10 h-10 text-xl',
        lg: 'w-12 h-12 text-2xl',
        xl: 'w-24 h-24 text-4xl'
    };

    const currentSize = sizeClasses[size] || sizeClasses.md;
    const gatewayAddr = localStorage.getItem('gateway_addr') || '';
    const gatewayToken = localStorage.getItem('gateway_token') || '';

    return (
        <div className={`${currentSize} flex-shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-bold text-primary ${className} overflow-hidden`}>
            {agent?.avatar ? (
                <img
                    src={agent.avatar.startsWith('data:') ? agent.avatar : `${gatewayAddr}/api/agents/${agent.id}/files/${agent.avatar}?token=${gatewayToken}&t=${Date.now()}`}
                    alt={`${agent.name} Avatar`}
                    className="w-full h-full object-cover"
                />
            ) : agent?.name ? (
                fallbackToInitials ? <span className="leading-none">{getInitials(agent.name)}</span> : null
            ) : null}
        </div>
    );
};

AgentAvatar.displayName = 'AgentAvatar';

export default AgentAvatar;
