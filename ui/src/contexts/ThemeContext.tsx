import React, { createContext, useContext, useState, useEffect } from 'react';

export type AccentTheme = 'default' | 'blue' | 'purple' | 'green' | 'red' | 'orange';

interface ThemeContextType {
    theme: 'light' | 'dark' | 'system';
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    accentTheme: AccentTheme;
    setAccentTheme: (accent: AccentTheme) => void;
    getThemeButtonClasses: () => string;
    getThemeInputClasses: () => string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_THEMES: AccentTheme[] = ['default', 'blue', 'purple', 'green', 'red', 'orange'];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        return (localStorage.getItem('theme') as any) || 'dark';
    });

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
        if (theme === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme as 'light' | 'dark';
    });

    const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => {
        return (localStorage.getItem('accent-theme') as AccentTheme) || 'default';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        const updateTheme = () => {
            let current: 'light' | 'dark';
            if (theme === 'system') {
                current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } else {
                current = theme;
            }

            root.classList.remove('light', 'dark');
            root.classList.add(current);
            setResolvedTheme(current);
        };

        updateTheme();
        localStorage.setItem('theme', theme);

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => updateTheme();
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    useEffect(() => {
        const root = window.document.documentElement;
        // Remove all accent theme classes
        ACCENT_THEMES.forEach(t => root.classList.remove(`theme-${t}`));
        // Add the new one (skip for default — no class needed, index.css is the default)
        if (accentTheme !== 'default') {
            root.classList.add(`theme-${accentTheme}`);
        }
        localStorage.setItem('accent-theme', accentTheme);
    }, [accentTheme]);

    const getThemeButtonClasses = () => {
        return "bg-accent-primary text-[var(--button-on-accent)] hover:opacity-90 shadow-md";
    };

    const getThemeInputClasses = () => {
        return "focus:outline-none focus:border-accent-primary dark:focus:border-accent-primary duration-100";
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, accentTheme, setAccentTheme, getThemeButtonClasses, getThemeInputClasses }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
