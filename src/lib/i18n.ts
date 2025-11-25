export const languages = {
  en: { code: 'en', name: 'English', countryCode: 'gb' },
  id: { code: 'id', name: 'Indonesia', countryCode: 'id' },
};

export const defaultLang = 'en';

export const ui = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.tasks': 'Tasks',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
  },
  id: {
    'nav.dashboard': 'Dasbor',
    'nav.tasks': 'Tugas',
    'nav.reports': 'Laporan',
    'nav.settings': 'Pengaturan',
  },
} as const;
