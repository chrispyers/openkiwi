import React from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const Tooltip = ({ content, children, className = '' }: TooltipProps) => {
    return (
        <div className={`relative group/tooltip flex items-center justify-center ${className}`}>
            {children}
            <div className="absolute bottom-full mb-2 px-3 py-1.5 bg-neutral-800 text-white text-md rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-100 whitespace-nowrap z-[100] shadow-xl border border-white/10 -translate-y-1 group-hover/tooltip:translate-y-0">
                {content}
            </div>
        </div>
    );
};
