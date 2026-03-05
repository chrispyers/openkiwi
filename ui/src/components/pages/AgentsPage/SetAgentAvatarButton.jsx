import Text from '../../Text';

const SetAgentAvatarButton = ({
    onClick,
    avatar,
    agentId,
    agentName,
    gatewayAddr,
    gatewayToken
}) => {
    return (
        <button
            onClick={onClick}
            title="Set Agent Avatar"
            className="w-12 h-12 mb-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden hover:opacity-80 transition-all flex-shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
            {avatar ? (
                <img
                    src={avatar.startsWith('data:') ? avatar : `${gatewayAddr}/api/agents/${agentId}/files/${avatar}?t=${Date.now()}&token=${gatewayToken}`}
                    alt={`${agentName} Avatar`}
                    className="w-full h-full object-cover"
                />
            ) : (
                <Text size="xl"></Text>
            )}
        </button>
    );
};

export default SetAgentAvatarButton;
