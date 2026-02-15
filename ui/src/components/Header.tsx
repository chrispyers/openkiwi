import React from 'react'
import {
    Cpu,
    RefreshCw,
    Menu
} from 'lucide-react'
import ThemeSelector from './ThemeSelector'

interface HeaderProps {
    isGatewayConnected: boolean;
    onRefresh?: () => void;
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isGatewayConnected, onRefresh, onMenuClick }) => {
    return (
        <header className="h-14 border-b border-border-color bg-bg-card flex items-center justify-between px-6 z-[60] shadow-sm">
            <div className="flex items-center gap-4">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 rounded-lg text-neutral-500 hover:text-accent-primary hover:bg-white-trans transition-all duration-200"
                        title="Toggle Navigation"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                        <Cpu size={18} className="text-white" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-neutral-600 dark:text-white">
                        LUNA <span className="text-accent-primary ml-1 text-xs font-medium px-1.5 py-0.5 bg-accent-primary/10 rounded">BETA</span>
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Connection Status */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${isGatewayConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isGatewayConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {isGatewayConnected ? 'GATEWAY CONNECTED' : 'GATEWAY DISCONNECTED'}
                </div>

                <div className="h-6 w-px bg-border-color mx-2" />

                <div className="flex items-center gap-4">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="p-2 rounded-lg text-neutral-500 hover:text-accent-primary hover:bg-white-trans transition-all"
                            title="Refresh Connection"
                        >
                            <RefreshCw size={18} />
                        </button>
                    )}

                    <ThemeSelector />
                </div>
            </div>
        </header>
    )
}

export default Header
