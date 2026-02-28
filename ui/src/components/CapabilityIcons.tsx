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
    noTooltip?: boolean;
}

const Icon = ({ className = '', children, tooltip, ariaLabel, small = false, noTooltip = false }: IconProps) => {
    // Only apply default backgrounds if not provided in className
    const hasBg = /\bbg-/.test(className);
    const hasDarkBg = /\bdark:bg-/.test(className);

    const bgDefaults = `${!hasBg ? 'bg-neutral-100' : ''} ${!hasDarkBg ? 'dark:bg-white/5' : ''}`;

    const content = (
        <div
            className={`${small ? 'w-5 h-5 rounded-md text-[10px]' : 'w-8 h-8 rounded-lg'} inline-flex items-center justify-center transition-colors ${bgDefaults} ${className}`}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );

    if (noTooltip) {
        return content;
    }

    return (
        <Tooltip content={tooltip}>
            {content}
        </Tooltip>
    );
};

export const EyeIcon = ({ small, noTooltip }: { small?: boolean, noTooltip?: boolean }) => (
    <Icon
        small={small}
        noTooltip={noTooltip}
        className="text-sky-600 bg-sky-100
            dark:text-sky-400 dark:bg-neutral-700"
        tooltip="This model can process image inputs"
        ariaLabel="Vision Capable"
    >
        <FontAwesomeIcon icon={faEye} />
    </Icon>
);

export const BrainIcon = ({ small, noTooltip }: { small?: boolean, noTooltip?: boolean }) => (
    <Icon
        small={small}
        noTooltip={noTooltip}
        className="text-violet-500 bg-violet-100
            dark:text-violet-400 dark:bg-neutral-700"
        tooltip="This model supports reasoning"
        ariaLabel="Reasoning Capable"
    >
        <FontAwesomeIcon icon={faBrain} />
    </Icon>
);

export const ToolIcon = ({ small, noTooltip }: { small?: boolean, noTooltip?: boolean }) => (
    <Icon
        small={small}
        noTooltip={noTooltip}
        className="text-neutral-500 bg-neutral-200
            dark:text-neutral-400 dark:bg-neutral-700"
        tooltip="This model has been trained for tool use"
        ariaLabel="Tool Use Capable"
    >
        <FontAwesomeIcon icon={faWrench} />
    </Icon>
);
