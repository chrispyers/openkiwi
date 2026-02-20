import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faBrain, faWrench } from '@fortawesome/free-solid-svg-icons';

interface IconProps {
    className?: string;
    children: React.ReactNode;
    tooltip: string;
    ariaLabel: string;
}

const Icon = ({ className = '', children, tooltip, ariaLabel }: IconProps) => {
    return (
        <div className="relative group/cap flex items-center justify-center" aria-label={ariaLabel}>
            <div className={`w-8 h-8 rounded-lg inline-flex items-center justify-center bg-neutral-100 dark:bg-white/5 transition-colors ${className}`}>
                {children}
            </div>
            <div className="absolute bottom-full mb-2 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg opacity-0 group-hover/cap:opacity-100 pointer-events-none transition-all duration-100 whitespace-nowrap z-[100] shadow-xl border border-white/10 -translate-y-1 group-hover/cap:translate-y-0">
                {tooltip}
            </div>
        </div>
    );
};

export const EyeIcon = () => (
    <Icon
        className="text-sky-400 bg-sky-100
            dark:text-sky-400 dark:bg-sky-800/70"
        tooltip="This model can process image inputs"
        ariaLabel="Vision Capable"
    >
        <FontAwesomeIcon icon={faEye} />
    </Icon>
);

export const BrainIcon = () => (
    <Icon
        className="text-violet-500 bg-violet-100
            dark:text-violet-400 dark:bg-violet-500/30"
        tooltip="This model supports reasoning"
        ariaLabel="Reasoning Capable"
    >
        <FontAwesomeIcon icon={faBrain} />
    </Icon>
);

export const ToolIcon = () => (
    <Icon
        className="text-neutral-600 bg-neutral-100
            dark:text-neutral-300 dark:bg-neutral-600/70"
        tooltip="This model has been trained for tool use"
        ariaLabel="Tool Use Capable"
    >
        <FontAwesomeIcon icon={faWrench} />
    </Icon>
);
