import React from 'react';

interface CodeProps {
    children: React.ReactNode;
    className?: string;
}

const Code: React.FC<CodeProps> = ({
    children,
    className = '',
}) => {
    return (
        <code className="
            bg-neutral-200 dark:bg-neutral-700
            text-neutral-800 dark:text-neutral-200
            px-1.5 py-0.5 rounded-md font-mono text-sm
            border border-neutral-300 dark:border-neutral-700/50">
            {children}
        </code>
    );
};

export default Code;
