import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
    theme: 'light' | 'dark' | 'system';
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    getThemeButtonClasses: () => string;
    getThemeInputClasses: () => string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

    const getThemeButtonClasses = () => {
        return "bg-accent-primary text-white dark:bg-white dark:text-neutral-600  hover:opacity-90 shadow-md";
    };

    const getThemeInputClasses = () => {
        return "focus:outline-none focus:border-accent-primary dark:focus:border-accent-primary duration-100";
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, getThemeButtonClasses, getThemeInputClasses }}>
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
