import React from 'react'
import Text from './Text'

export type TableAlignment = 'left' | 'center' | 'right';

export interface HeaderObject {
    name: string;
    alignment?: TableAlignment;
}

export type HeaderItem = string | HeaderObject;

export function TABLE(props: { header?: HeaderItem[], children: React.ReactNode, className?: string, center?: boolean }) {
    return (
        <table className={(props.className || "") + " w-full text-left border-separate border-spacing-0 rounded-xl overflow-hidden"}>
            {props.header != null && (
                <thead style={{ backgroundColor: 'var(--table-header-bg)' }}>
                    <tr>
                        {props.header.map((item, idx) => {
                            const name = typeof item === 'string' ? item : item.name;
                            let alignment: TableAlignment = props.center ? 'center' : 'left';

                            if (typeof item !== 'string') {
                                alignment = item.alignment || 'center';
                            }

                            return (
                                <TH key={idx} alignment={alignment}>
                                    {name}
                                </TH>
                            );
                        })}
                    </tr>
                </thead>
            )}
            <tbody style={{ backgroundColor: 'var(--table-body-bg)' }}>
                {props.children}
            </tbody>
        </table>
    )
}

export function TH({ children, alignment = 'left' }: { children: React.ReactNode, alignment?: TableAlignment }) {
    const alignmentClass = alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left';
    return (
        <th className={`py-4 px-6 text-xs uppercase tracking-wider ${alignmentClass}`}>
            <Text size="xs" bold={true} className="!text-[var(--table-header-text)]">
                {children}
            </Text>
        </th>
    )
}

export function TR({ className, onClick, children, highlight = false }: { className?: string, onClick?: () => void, children: React.ReactNode, highlight?: boolean }) {
    return (
        <tr
            className={`${className || ""} cursor-pointer transition-colors group ${highlight ? 'hover:bg-black/10 dark:hover:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={onClick || (() => { })}
        >
            {children}
        </tr>
    )
}

export function TD({ children, className, colSpan }: { children: React.ReactNode, className?: string, colSpan?: number }) {
    return (
        <td colSpan={colSpan} className={`${className || ""} py-4 px-6 text-sm border-t border-border-color`}>
            {children}
        </td>
    )
}
