import React from 'react';

interface TextProps {
    children: React.ReactNode;
    secondary?: boolean;
    bold?: boolean;
    code?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    className?: string;
}

/**
 * Text Component
 * 
 * A reusable text component for consistent typography across the application.
 */
const Text: React.FC<TextProps> = ({
    children,
    secondary = false,
    bold = false,
    code = false,
    size = 'md',
    className = ''
}) => {
    const sizeMap: Record<string, string> = {
        xs: 'text-xs',
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl',
        '4xl': 'text-4xl',
        '5xl': 'text-5xl',
    };

    const sizeClass = sizeMap[size] || 'text-base';
    const boldClass = bold ? 'font-bold' : 'font-normal';
    const codeClass = code ? 'font-mono' : '';

    return (
        <span className={`${sizeClass} ${boldClass} ${codeClass} ${colorClass} ${className} subpixel-antialiased`}>
            {children}
        </span>
    );
};

export default Text;
