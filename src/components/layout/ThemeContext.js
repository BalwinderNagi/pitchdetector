import React, { createContext, useState } from 'react';

export const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [proMode,    setProMode]    = useState(false);

  const lightTheme = { backgroundColor: '#fff', textColor: '#000' };
  const darkTheme  = { backgroundColor: '#000', textColor: '#fff' };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  function toggleTheme() {
    setIsDarkMode(d => !d);
  }

  function toggleProMode() {
    setProMode(p => !p);
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        isDarkMode,
        toggleTheme,
        proMode,
        toggleProMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
