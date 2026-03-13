import React from 'react'
import Text from './Text'

export function TABLE(props) {
    const { header, children, className, center, stickyHeader } = props;
    return (
        <table
            className={(className || "") + ` w-full text-left ${stickyHeader ? '' : 'rounded-xl overflow-hidden'}`}
            style={stickyHeader ? undefined : { border: '1px solid var(--table-border-color)' }}
        >
            {header != null && (
                <thead
                    className={stickyHeader ? 'sticky top-0 z-10' : ''}
                    style={{
                        backgroundColor: 'var(--table-header-bg)',
                        ...(stickyHeader ? { borderBottom: '1px solid var(--table-border-color)' } : {})
                    }}
                >
                    <tr>
                        {header.map((item, idx) => {
                            const name = typeof item === 'string' ? item : item.name;
                            let alignment = center ? 'center' : 'left';

                            if (typeof item !== 'string') {
                                alignment = item.alignment || 'center';
                            }

                            const thClassName = typeof item !== 'string' ? (item.className || '') : '';
                            return (
                                <TH key={idx} alignment={alignment} className={thClassName}>
                                    {name}
                                </TH>
                            );
                        })}
                    </tr>
                </thead>
            )}
            <tbody style={{ backgroundColor: 'var(--table-body-bg)' }}>
                {children}
            </tbody>
        </table>
    )
}

export function TH({ children, alignment = 'left', className = '' }) {
    const alignmentClass = alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left';
    return (
        <th className={`py-4 px-6 text-xs uppercase tracking-wider ${alignmentClass} ${className}`}>
            <Text size="xs" bold={true} className="!text-[var(--table-header-text)]">
                {children}
            </Text>
        </th>
    )
}

export function TR({ className, onClick, children, highlight = false }) {
    return (
        <tr
            className={`${className || ""} cursor-pointer transition-colors group ${highlight ? 'hover:bg-black/10 dark:hover:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={onClick || (() => { })}
        >
            {children}
        </tr>
    )
}

export function TD({ children, className, colSpan }) {
    return (
        <td
            colSpan={colSpan}
            className={`${className || ""} py-4 px-6 text-sm`}
            style={{ borderTop: '1px solid var(--table-border-color)' }}
        >
            {children}
        </td>
    )
}
