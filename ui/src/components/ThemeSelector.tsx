import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './Button';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
import Text from './Text';

/**
 * ThemeSelector Component
 * 
 * A segmented control for switching between Light, Dark, and System themes.
 * It uses three separate Button components styled to appear as a single unified pill.
 */
export default function ThemeSelector() {
    const { theme, setTheme } = useTheme();

    const options = [
        { id: 'light', name: 'Light', icon: faSun },
        { id: 'dark', name: 'Dark', icon: faMoon },
        { id: 'system', name: 'System', icon: faDesktop },
    ] as const;

    return (
        <Text>
            <div className="inline-flex bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-full border border-border-color shadow-sm w-fit">
                {options.map((option) => (
                    <Button
                        key={option.id}
                        themed={theme === option.id}
                        onClick={() => setTheme(option.id)}
                        className={`ml-0.5 mr-0.5 !py-1 !px-3 !rounded-full transition-all duration-300 flex items-center justify-center
                            ${theme === option.id
                                ? `shadow-sm !text-white dark:!text-neutral-600`
                                : '!bg-transparent'}`}
                        icon={option.icon}
                        title={option.name}
                    />
                ))}
            </div>
        </Text>
    );
}
