import React from 'react'
import Text from './Text'
import {
    Cpu,
    Menu
} from 'lucide-react'
import ThemeSelector from './ThemeSelector'
import { useTheme } from '../contexts/ThemeContext'
import { faInfoCircle, faBrain } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Badge from './Badge';
import Button from './Button';

const Header = ({ isGatewayConnected, onMenuClick }) => {
    const { theme } = useTheme();
    return (
        <header className="h-14 border-b border-divider bg-white dark:bg-surface flex items-center justify-between px-6 z-[60] shadow-sm">
            <div className="flex items-center gap-4">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 rounded-lg text-primary hover:text-accent-primary hover:bg-white-trans transition-all duration-100"
                        title="Toggle Navigation"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
                        <FontAwesomeIcon icon={faBrain} className="text-[var(--button-on-accent)]" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-primary">
                        <Text bold={true} size="lg">OpenKIWI</Text>
                        <Badge className="ml-2 uppercase" size="xs">beta</Badge>
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Connection Status */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${isGatewayConnected ? 'bg-emerald-500/10 dark:bg-emerald-200/20 text-emerald-500 dark:text-emerald-200' : 'bg-red-500/10 text-red-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isGatewayConnected ? 'bg-emerald-500 dark:bg-emerald-200 animate-pulse' : 'bg-red-500'}`} />
                    {isGatewayConnected ? 'GATEWAY CONNECTED' : 'GATEWAY DISCONNECTED'}
                </div>

                <div className="h-6 w-px bg-border-color mx-2" />

                <div className="flex items-center gap-4">
                    <ThemeSelector />
                </div>
            </div>
        </header>
    )
}

export default Header
