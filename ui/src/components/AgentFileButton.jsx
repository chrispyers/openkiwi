import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from './Button';
import Text from './Text';

const AgentFileButton = ({
    title,
    description,
    icon,
    onClick,
    iconColorClass
}) => {
    return (
        <Button
            padding={3}
            className="w-full !justify-start"
            onClick={onClick}
        >
            <div className="flex items-center gap-4 text-left w-full">
                <div className={`w-12 h-12 rounded-xl bg-white-trans flex-shrink-0 flex items-center justify-center ${iconColorClass} transition-all`}>
                    <Text size="2xl">
                        <FontAwesomeIcon icon={icon} />
                    </Text>
                </div>
                <div className="min-w-0">
                    <div>
                        <Text size="sm" bold={true} className="leading-tight">
                            {title}
                        </Text>
                    </div>
                    <div>
                        <Text size="xs" secondary={true} className="leading-tight">
                            {description}
                        </Text>
                    </div>
                </div>
            </div>
        </Button >
    );
};

export default AgentFileButton;
