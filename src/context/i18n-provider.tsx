'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { languages, defaultLang, ui } from '@/lib/i18n';

type Lang = keyof typeof ui;
type Key = keyof (typeof ui)[Lang];

type Language = {
  code: string;
  name: string;
  countryCode: string;
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Lang) => void;
  t: (key: Key) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(defaultLang);

  const setLanguage = (newLang: Lang) => {
    setLang(newLang);
  };

  const t = (key: Key) => {
    return ui[lang][key] || ui[defaultLang][key];
  };
  
  const language = languages[lang];

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [lang]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
