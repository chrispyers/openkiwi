import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    getThemeButtonClasses: () => string;
    getThemeInputClasses: () => string;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        return (localStorage.getItem('theme') as any) || 'dark';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const getThemeButtonClasses = () => {
        return "bg-accent-primary text-white dark:bg-white dark:text-neutral-600  hover:opacity-90 shadow-md";
    };

    const getThemeInputClasses = () => {
        return "focus:outline-none focus:border-accent-primary dark:focus:border-accent-primary duration-100";
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, getThemeButtonClasses, getThemeInputClasses }}>
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
