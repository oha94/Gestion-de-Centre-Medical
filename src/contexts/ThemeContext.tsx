import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { ThemeService, Theme } from '../services/ThemeService';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    presets: Theme[];
    isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: ThemeService.getDefaultTheme(),
    setTheme: () => { },
    presets: [],
    isLoading: true
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(ThemeService.getDefaultTheme());
    const [presets] = useState<Theme[]>(ThemeService.getPresets());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const loadedTheme = await ThemeService.loadTheme();
            if (loadedTheme) {
                setThemeState(loadedTheme);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            await ThemeService.saveTheme(newTheme);
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, presets, isLoading }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
