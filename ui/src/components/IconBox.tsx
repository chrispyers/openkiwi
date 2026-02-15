import React from 'react';

interface IconBoxProps {
    icon: React.ReactNode;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent';
}

const IconBox: React.FC<IconBoxProps> = ({
    icon,
    className = '',
    size = 'md',
    variant = 'accent'
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 rounded-lg text-lg',
        md: 'w-10 h-10 rounded-xl text-xl',
        lg: 'w-12 h-12 rounded-2xl text-2xl'
    };

    const variantClasses = {
        primary: 'bg-bg-primary text-neutral-600 dark:text-white',
        secondary: 'bg-bg-card text-neutral-600 dark:text-white',
        accent: 'bg-accent-primary/10 text-accent-primary',
        transparent: 'bg-white-trans text-neutral-600 dark:text-white'
    };

    return (
        <div className={`flex items-center justify-center flex-shrink-0 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
            {icon}
        </div>
    );
};

export default IconBox;
