import React from 'react';
import Text from '../Text'

interface PageProps {
    title: string;
    subtitle?: string;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
}

export default function Page({ title, subtitle, headerAction, children }: PageProps) {
    return (
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto h-full box-border bg-white dark:bg-neutral-900/5 m-6 rounded-xl shadow-sm">
            <header className="mb-10 animate-fade-in-up flex items-center justify-between">
                <div>
                    <Text size="3xl" bold={true}>{title}</Text>
                    {subtitle && (
                        <p>
                            <Text secondary={true}>{subtitle}</Text>
                        </p>
                    )}
                </div>
                {headerAction && (
                    <div className="ml-4 shrink-0 flex items-center">
                        {headerAction}
                    </div>
                )}
            </header>
            <div className="w-full animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                {children}
            </div>
        </div>
    );
}
