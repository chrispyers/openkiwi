
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faComments,
    faRobot,
    faServer,
    faCube,
    faFileLines,
    faGear
} from '@fortawesome/free-solid-svg-icons';

interface SidebarProps {
    isNavExpanded: boolean;
    activeView: string;
    createNewSession: () => void;
}

export default function Sidebar({ isNavExpanded, activeView, createNewSession }: SidebarProps) {
    const navigate = useNavigate();

    const navItems = [
        { id: 'chat', icon: faComments, label: 'Chat' },
        { id: 'agents', icon: faRobot, label: 'Agents' },
        { id: 'gateway', icon: faServer, label: 'Gateway' },
        { id: 'models', icon: faCube, label: 'Models' },
        { id: 'logs', icon: faFileLines, label: 'Logs' },
        { id: 'settings', icon: faGear, label: 'Settings' },
    ];

    return (
        <nav className={`${isNavExpanded ? 'w-48' : 'w-16'} bg-bg-sidebar flex flex-col items-center py-6 gap-2 z-51 transition-all duration-300`}>
            {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => {
                        if (item.id === 'chat') createNewSession();
                        navigate('/' + item.id);
                    }}
                    className={`w-[calc(100%-1rem)] mx-2 px-3 py-3 rounded-xl transition-all duration-200 group relative flex items-center gap-4 ${activeView === item.id
                        ? 'bg-accent-primary text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                        : 'text-neutral-500 hover:bg-white-trans hover:text-neutral-600 dark:text-white'
                        }`}
                    title={isNavExpanded ? undefined : item.label}
                >
                    <div className={`flex-shrink-0 w-6 flex justify-center`}>
                        <FontAwesomeIcon icon={item.icon} className="text-lg" />
                    </div>

                    {isNavExpanded && (
                        <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                            {item.label}
                        </span>
                    )}


                    {!isNavExpanded && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-xl border border-white/10 translate-x-1 group-hover:translate-x-0">
                            {item.label}
                        </div>
                    )}


                </button>
            ))}
        </nav>
    );
}
