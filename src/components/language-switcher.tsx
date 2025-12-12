
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/context/i18n-provider';
import { languages } from '@/lib/i18n';
import Image from 'next/image';

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  const FlagImage = ({ countryCode }: { countryCode: string }) => (
    <Image
      src={`https://flagcdn.com/w20/${countryCode}.png`}
      width={20}
      height={15}
      alt={countryCode}
      className="rounded-sm"
      style={{ height: 'auto' }}
    />
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <FlagImage countryCode={language.countryCode} />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.values(languages).map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as 'en' | 'id')}
          >
            <div className="flex items-center gap-2">
              <FlagImage countryCode={lang.countryCode} />
              <span>{lang.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
