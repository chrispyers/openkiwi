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
    faGear,
    faArrowsSpin,
    faDiagramProject,
    faFolder,
    faFolderOpen
} from '@fortawesome/free-solid-svg-icons';

export default function Sidebar({
    isNavExpanded,
    activeView,
    createNewSession,
    isGatewayConnected,
    hasAgents,
    hasModels,
    hasActiveAgents,
    onSettingsClick,
    isProjectManagementEnabled,
    isAgentActivityEnabled
}) {
    const navigate = useNavigate();
    const { theme } = useTheme();

    const navItems = [
        { id: 'chat', icon: faComments, label: 'Chat' },
        { id: 'activity', icon: faArrowsSpin, label: 'Activity', showActive: hasActiveAgents, experimentalActivity: true },
        { experimentalProjectManagement: true },
        { id: 'projects', icon: faFolder, label: 'Projects', experimentalProjectManagement: true },
        { id: 'workflows', icon: faDiagramProject, label: 'Workflows', experimentalProjectManagement: true },
        { id: 'workspace', icon: faFolderOpen, label: 'Workspace' },
        {},
        { id: 'agents', icon: faRobot, label: 'Agents', showAlert: !hasAgents },
        { id: 'gateway', icon: faServer, label: 'Gateway', showAlert: !isGatewayConnected },
        { id: 'models', icon: faCube, label: 'Models', showAlert: !hasModels },
        { id: 'logs', icon: faFileLines, label: 'Logs' },
        { id: 'settings', icon: faGear, label: 'Settings' },
    ].filter((item) => {
        if (item.experimentalProjectManagement && !isProjectManagementEnabled) return false;
        if (item.experimentalActivity && !isAgentActivityEnabled) return false;
        return true;
    });

    return (
        <nav className={`${isNavExpanded ? 'w-44' : 'w-16'} bg-sidebar flex flex-col items-center py-6 gap-2 z-51 transition-all duration-300`}>
            {navItems.map((item, idx) => (
                <React.Fragment key={idx}>
                    {
                        item.id ?

                            <button
                                key={item.id}
                                onClick={() => {
                                    if (item.id === 'chat') createNewSession();
                                    if (item.id === 'settings' && onSettingsClick) onSettingsClick();
                                    navigate('/' + item.id);
                                }}
                                className={`w-[calc(100%-1rem)] mx-2 px-3 py-3 rounded-xl transition-all duration-50 group relative flex items-center gap-4 ${activeView === item.id
                                    ? `bg-accent-primary text-white dark:text-neutral-600 shadow-lg shadow-accent-primary/20`
                                    : 'text-primary hover:bg-neutral-200 dark:hover:bg-neutral-800'
                                    }`}
                                title={isNavExpanded ? undefined : item.label}
                            >
                                <div className={`flex-shrink-0 w-6 flex justify-center relative`}>
                                    <FontAwesomeIcon icon={item.icon} className="text-lg" />
                                    {item.showAlert && !isNavExpanded && (
                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-sidebar animate-pulse" />
                                    )}
                                    {item.showActive && !isNavExpanded && (
                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-bg-sidebar animate-pulse" />
                                    )}
                                </div>

                                {isNavExpanded && (
                                    <div className="flex flex-1 items-center justify-between min-w-0">
                                        <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500 overflow-hidden text-overflow-ellipsis">
                                            {item.label}
                                        </span>
                                        {item.showAlert && (
                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                        )}
                                        {item.showActive && (
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        )}
                                    </div>
                                )}


                                {!isNavExpanded && (
                                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-100 whitespace-nowrap z-[100] shadow-xl border border-white/10 translate-x-1 group-hover:translate-x-0">
                                        {item.label}
                                    </div>
                                )}


                            </button>
                            :
                            <div className="h-px bg-neutral-300 dark:bg-neutral-700 m-3 pl-10 pr-10" />
                    }
                </React.Fragment>
            ))}
        </nav>
    );
}
