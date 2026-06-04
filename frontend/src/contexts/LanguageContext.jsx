import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('app_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const toggleLang = () => setLang(l => l === 'en' ? 'hi' : 'en');

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
