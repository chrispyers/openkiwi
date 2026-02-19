import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

export function TABLE(props: { header?: string[], children: React.ReactNode, className?: string, center?: boolean }) {
    return (
        <table className={(props.className || "") + " w-full text-left"}>
            {props.header != null && (
                <thead>
                    {props.header.map((obj, idx) => (
                        <TH key={idx} center={props.center}>
                            {obj}
                        </TH>
                    ))}
                </thead>
            )}
            <tbody className="divide-y divide-border-color/50">
                {props.children}
            </tbody>
        </table>
    )
}

export function TH({ children, center }: { children: React.ReactNode, center?: boolean }) {
    return (
        <th className={`py-4 px-6 text-xs text-neutral-500 dark:text-white uppercase tracking-[0.1em] ${center ? 'text-center' : ''}`}>
            {children}
        </th>
    )
}

export function TR({ className, onClick, children, highlight = false }: { className?: string, onClick?: () => void, children: React.ReactNode, highlight?: boolean }) {
    return (
        <tr
            className={`${className || ""} cursor-pointer transition-colors group ${highlight ? 'hover:bg-neutral-200 dark:hover:bg-neutral-700' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            onClick={onClick || (() => { })}
        >
            {children}
        </tr>
    )
}

export function TD({ children, className, colSpan }: { children: React.ReactNode, className?: string, colSpan?: number }) {
    return (
        <td colSpan={colSpan} className={`${className || ""} py-4 px-6 text-sm border-t border-border-color/30`}>
            {children}
        </td>
    )
}
