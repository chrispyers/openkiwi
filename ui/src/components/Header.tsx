import React from 'react'
import Text from './Text'
import {
    Cpu,
    Menu
} from 'lucide-react'
import ThemeSelector from './ThemeSelector'
import { useTheme } from '../contexts/ThemeContext'
import { faInfoCircle, faLemon } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Badge from './Badge';
import Button from './Button';

interface HeaderProps {
    isGatewayConnected: boolean;
    onMenuClick?: () => void;
    updateAvailable?: boolean;
    onUpdateClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isGatewayConnected, onMenuClick, updateAvailable, onUpdateClick }) => {
    const { theme } = useTheme();
    return (
        <header className="h-14 border-b border-border-color bg-bg-primary flex items-center justify-between px-6 z-[60] shadow-sm">
            <div className="flex items-center gap-4">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 rounded-lg text-neutral-500 hover:text-accent-primary hover:bg-white-trans transition-all duration-100"
                        title="Toggle Navigation"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
                        <FontAwesomeIcon icon={faLemon} className="text-white dark:text-neutral-600" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-neutral-600 dark:text-white">
                        <Text bold={true} size="lg">OpenKIWI</Text>
                        <Badge className="ml-2 uppercase" size="xs">beta</Badge>
                    </h1>
                </div>
            </div>

            {updateAvailable && (
                <div className="absolute left-1/2 -translate-x-1/2">
                    <button
                        onClick={onUpdateClick}
                        className="hover:scale-105 transition-transform duration-100 active:scale-95"
                        title="Click to see upgrade steps"
                    >
                        <Button
                            icon={faInfoCircle}
                            themed={true}
                            className="text-green-200"
                        >
                            <Text className="text-green-200" bold={true}>UPDATE AVAILABLE</Text>
                        </Button>
                    </button>
                </div>
            )}

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
