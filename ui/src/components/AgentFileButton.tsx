import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import Card from './Card';
import Text from './Text';

interface AgentFileButtonProps {
    title: string;
    description: string;
    icon: IconDefinition;
    onClick: () => void;
    iconColorClass: string;
}

const AgentFileButton: React.FC<AgentFileButtonProps> = ({
    title,
    description,
    icon,
    onClick,
    iconColorClass
}) => {
    return (
        <Card
            padding="p-1"
            className="rounded-xl group flex justify-between items-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all cursor-pointer"
            onClick={onClick}
        >
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-white-trans flex items-center justify-center ${iconColorClass} transition-all`}>
                    <Text size="2xl">
                        <FontAwesomeIcon icon={icon} />
                    </Text>
                </div>
                <div>
                    <div className="text-xs">
                        <Text size="xs" bold={true}>
                            {title}
                        </Text>
                    </div>
                    <div className="text-xs">
                        <Text size="xs" secondary={true}>
                            {description}
                        </Text>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default AgentFileButton;
