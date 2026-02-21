import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTheme } from '../contexts/ThemeContext';
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
    isGatewayConnected: boolean;
    hasAgents: boolean;
    hasModels: boolean;
}

export default function Sidebar({ isNavExpanded, activeView, createNewSession, isGatewayConnected, hasAgents, hasModels }: SidebarProps) {
    const navigate = useNavigate();
    const { theme } = useTheme();

    const navItems = [
        { id: 'chat', icon: faComments, label: 'Chat' },
        { id: 'agents', icon: faRobot, label: 'Agents', showAlert: !hasAgents },
        { id: 'gateway', icon: faServer, label: 'Gateway', showAlert: !isGatewayConnected },
        { id: 'models', icon: faCube, label: 'Models', showAlert: !hasModels },
        { id: 'logs', icon: faFileLines, label: 'Logs' },
        { id: 'settings', icon: faGear, label: 'Settings' },
    ];

    return (
        <nav className={`${isNavExpanded ? 'w-44' : 'w-16'} bg-bg-sidebar flex flex-col items-center py-6 gap-2 z-51 transition-all duration-300`}>
            {navItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => {
                        if (item.id === 'chat') createNewSession();
                        navigate('/' + item.id);
                    }}
                    className={`w-[calc(100%-1rem)] mx-2 px-3 py-3 rounded-xl transition-all duration-100 group relative flex items-center gap-4 ${activeView === item.id
                        ? `bg-accent-primary text-white dark:text-neutral-600 shadow-lg shadow-accent-primary/20`
                        : 'text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-800 dark:text-white'
                        }`}
                    title={isNavExpanded ? undefined : item.label}
                >
                    <div className={`flex-shrink-0 w-6 flex justify-center relative`}>
                        <FontAwesomeIcon icon={item.icon} className="text-lg" />
                        {item.showAlert && !isNavExpanded && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-sidebar animate-pulse" />
                        )}
                    </div>

                    {isNavExpanded && (
                        <div className="flex flex-1 items-center justify-between min-w-0">
                            <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300 overflow-hidden text-overflow-ellipsis">
                                {item.label}
                            </span>
                            {item.showAlert && (
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}
                        </div>
                    )}


                    {!isNavExpanded && (
                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-100 whitespace-nowrap z-[100] shadow-xl border border-white/10 translate-x-1 group-hover:translate-x-0">
                            {item.label}
                        </div>
                    )}


                </button>
            ))}
        </nav>
    );
}
