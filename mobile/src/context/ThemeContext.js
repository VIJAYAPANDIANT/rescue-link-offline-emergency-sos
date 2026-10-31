import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('system'); // 'system' | 'light' | 'dark'

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const themeColors = isDark ? darkColors : lightColors;

  const theme = {
    colors: themeColors,
    spacing,
    borderRadius,
    typography,
    shadows,
    isDark,
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themeColors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    return {
      theme: {
        colors: lightColors,
        spacing,
        borderRadius,
        typography,
        shadows,
        isDark: false,
      },
      colors: lightColors,
      isDark: false,
      mode: 'light',
      setMode: () => {},
    };
  }
  return context;
};

export default ThemeContext;
