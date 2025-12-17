
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useUserProfile, useAuth, initiateSignOut } from '@/firebase';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';
import { useI18n } from '@/context/i18n-provider';

export function UserNav() {
  const router = useRouter();
  const auth = useAuth();
  const { user, profile, isLoading } = useUserProfile();
  const { t } = useI18n();

  const handleLogout = () => {
    if (auth) {
      initiateSignOut(auth);
      router.push('/login');
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'A';
    return name.split(' ').map(n => n[0]).join('');
  }
  
  if (isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!user) {
    return null;
  }
  
  const roleColors: Record<string, string> = {
    'Super Admin': 'bg-red-500 text-white',
    'Manager': 'bg-blue-500 text-white',
    'Employee': 'bg-green-500 text-white',
    'Client': 'bg-gray-500 text-white',
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary">
            {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.name || 'User'} key={profile.avatarUrl} />}
            <AvatarFallback>{getInitials(profile?.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{profile?.name || 'Anonymous User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {profile?.email || 'No email associated'}
            </p>
            {profile?.role && (
                <Badge variant="secondary" className={`max-w-fit ${roleColors[profile.role]}`}>{profile.role}</Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/settings">
            <DropdownMenuItem>
              <UserIcon />
              {t('nav.profile')}
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
