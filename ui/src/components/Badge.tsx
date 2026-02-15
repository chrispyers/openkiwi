import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outline' | 'accent' | 'danger' | 'success';
}

const Badge: React.FC<BadgeProps> = ({
    children,
    className = '',
    variant = 'default'
}) => {
    const baseClasses = 'px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-widest inline-flex items-center justify-center';

    const variantClasses = {
        default: 'bg-white/5 text-neutral-500 dark:text-neutral-400',
        outline: 'border border-current text-neutral-500',
        accent: 'bg-accent-primary/10 text-accent-primary',
        danger: 'bg-red-500/10 text-red-500',
        success: 'bg-emerald-500/10 text-emerald-500'
    };

    return (
        <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;
