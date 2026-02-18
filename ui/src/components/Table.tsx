import React from 'react'
import { useTheme } from '../contexts/ThemeContext'

export function TABLE(props: { header?: string[], children: React.ReactNode, className?: string, center?: boolean }) {
    return (
        <table className={(props.className || "") + " w-full text-left"}>
            {props.header != null && (
                <thead>
                    <tr className="">
                        {props.header.map((obj, idx) => (
                            <TH key={idx} center={props.center}>
                                {obj}
                            </TH>
                        ))}
                    </tr>
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

export function TR({ className, onClick, children }: { className?: string, onClick?: () => void, children: React.ReactNode }) {
    return (
        <tr
            className={`${className || ""} cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors group`}
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
