import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faBrain, faWrench } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from './Tooltip';

interface IconProps {
    className?: string;
    children: React.ReactNode;
    tooltip: string;
    ariaLabel: string;
    small?: boolean;
}

const Icon = ({ className = '', children, tooltip, ariaLabel, small = false }: IconProps) => {
    return (
        <Tooltip content={tooltip}>
            <div
                className={`${small ? 'w-5 h-5 rounded-md text-[10px]' : 'w-8 h-8 rounded-lg'} inline-flex items-center justify-center bg-neutral-100 dark:bg-white/5 transition-colors ${className}`}
                aria-label={ariaLabel}
            >
                {children}
            </div>
        </Tooltip>
    );
};

export const EyeIcon = ({ small }: { small?: boolean }) => (
    <Icon
        small={small}
        className="text-sky-500/70 bg-sky-100
            dark:text-sky-400 dark:bg-sky-800/70"
        tooltip="This model can process image inputs"
        ariaLabel="Vision Capable"
    >
        <FontAwesomeIcon icon={faEye} />
    </Icon>
);

export const BrainIcon = ({ small }: { small?: boolean }) => (
    <Icon
        small={small}
        className="text-violet-500/80 bg-violet-100
            dark:text-violet-400 dark:bg-violet-500/30"
        tooltip="This model supports reasoning"
        ariaLabel="Reasoning Capable"
    >
        <FontAwesomeIcon icon={faBrain} />
    </Icon>
);

export const ToolIcon = ({ small }: { small?: boolean }) => (
    <Icon
        small={small}
        className="text-neutral-600/80 bg-neutral-200/50
            dark:text-neutral-300 dark:bg-neutral-600/70"
        tooltip="This model has been trained for tool use"
        ariaLabel="Tool Use Capable"
    >
        <FontAwesomeIcon icon={faWrench} />
    </Icon>
);
