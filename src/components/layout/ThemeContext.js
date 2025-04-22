import React, { createContext, useState, useContext } from 'react';

export const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const lightTheme = {
    backgroundColor: '#fff',
    textColor: '#000',
  };

  const darkTheme = {
    backgroundColor: '#000',
    textColor: '#fff',
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  function toggleTheme() {
    setIsDarkMode(!isDarkMode);
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;