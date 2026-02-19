import React from 'react';
import { Eye, Brain, Wrench } from 'lucide-react';

interface IconProps {
    className?: string;
    children: React.ReactNode;
}

const Icon = ({ className = '', children }: IconProps) => {
    return (
        <div className={`w-8 h-8 rounded-lg inline-flex items-center justify-center bg-neutral-100 dark:bg-white/5 ${className}`}>
            {children}
        </div>
    );
};

export const EyeIcon = () => (
    <Icon className="text-orange-600 dark:text-orange-400" aria-label="Vision Capable">
        <Eye size={16} />
    </Icon>
);

export const BrainIcon = () => (
    <Icon className="text-emerald-600 dark:text-emerald-400" aria-label="Reasoning/Thinking">
        <Brain size={16} />
    </Icon>
);

export const ToolIcon = () => (
    <Icon className="text-blue-600 dark:text-blue-400" aria-label="Tool Use">
        <Wrench size={16} />
    </Icon>
);
