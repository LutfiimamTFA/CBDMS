
'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { SharedLink } from '@/lib/types';
import { Share2, Link, Copy, Settings, CalendarIcon, KeyRound, Loader2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, where } from 'firebase/firestore';

export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<SharedLink | null>(null);
  
  const [accessLevel, setAccessLevel] = useState<SharedLink['accessLevel']>('view');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const pathname = usePathname();
  const { toast } = useToast();

  const targetId = useMemo(() => {
    // This is a simplified logic. In a real app, you might have more complex routing.
    if (pathname.includes('/tasks/')) {
        return pathname.split('/tasks/')[1];
    }
    if (pathname.includes('/dashboard')) return 'dashboard';
    return 'dashboard'; // Default to sharing the dashboard
  }, [pathname]);

  const targetType = useMemo(() => {
     if (pathname.includes('/tasks/')) return 'task';
     return 'dashboard';
  }, [pathname]);
  
  const linksQuery = useMemo(() => {
      if (!firestore || !profile) return null;
      return query(
          collection(firestore, 'sharedLinks'),
          where('companyId', '==', profile.companyId),
          where('targetId', '==', targetId),
          where('targetType', '==', targetType)
      )
  }, [firestore, profile, targetId, targetType]);

  const { data: existingLinks, isLoading: isLinksLoading } = useCollection<SharedLink>(linksQuery);

  const activeLink = useMemo(() => {
      if (existingLinks && existingLinks.length > 0) {
          return existingLinks[0];
      }
      return null;
  }, [existingLinks]);

  React.useEffect(() => {
    if(activeLink) {
        setCreatedLink(activeLink);
        setAccessLevel(activeLink.accessLevel);
        setPassword(activeLink.password ? '********' : '');
        setUsePassword(!!activeLink.password);
        setExpiresAt(activeLink.expiresAt ? new Date(activeLink.expiresAt) : undefined);
        setUseExpiration(!!activeLink.expiresAt);
    } else {
        setCreatedLink(null);
    }
  }, [activeLink]);


  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    setIsLoading(true);
    
    // For now, we won't handle password hashing on the client.
    // In a real app, this should be done on a server/cloud function.
    if (usePassword && !password) {
        toast({ variant: 'destructive', title: 'Password required' });
        setIsLoading(false);
        return;
    }
    
    const linkData: Omit<SharedLink, 'id'> = {
      targetId,
      targetType,
      accessLevel,
      createdBy: profile.id,
      createdAt: serverTimestamp(),
      companyId: profile.companyId,
      ...(usePassword && { password: password }), // WARNING: Storing plain text password
      ...(useExpiration && expiresAt && { expiresAt: expiresAt.toISOString() }),
    };

    try {
      const docRef = await addDoc(collection(firestore, 'sharedLinks'), linkData);
      setCreatedLink({ ...linkData, id: docRef.id, createdAt: new Date() });
      toast({ title: 'Share link created!' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to create link' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleUpdateLink = async () => {
    if (!firestore || !createdLink) return;
    setIsLoading(true);
    
    const linkRef = doc(firestore, 'sharedLinks', createdLink.id);
    const updates: Partial<SharedLink> = {
        accessLevel,
        expiresAt: useExpiration && expiresAt ? expiresAt.toISOString() : undefined,
        password: usePassword ? password : undefined,
    };

    // Remove undefined fields
    Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

    try {
      await updateDoc(linkRef, updates);
      toast({ title: 'Link updated successfully!' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to update link' });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDisableLink = async () => {
    if (!firestore || !createdLink) return;
    setIsLoading(true);
    try {
        await deleteDoc(doc(firestore, 'sharedLinks', createdLink.id));
        setCreatedLink(null);
        toast({ title: 'Share link disabled' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Failed to disable link' });
    } finally {
        setIsLoading(false);
    }
  }

  const shareUrl = createdLink ? `${window.location.origin}/share/${createdLink.id}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link copied to clipboard!' });
  };
  
  const isLoadingAnything = isLoading || isProfileLoading || isLinksLoading;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Dashboard</DialogTitle>
          <DialogDescription>
            {createdLink ? 'Manage settings for the shareable link.' : 'Generate a link to share this view with others.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingAnything ? (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        ) : createdLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="share-link">Shareable Link</Label>
                <div className="flex items-center gap-2">
                    <Input id="share-link" value={shareUrl} readOnly />
                    <Button size="icon" onClick={copyToClipboard}><Copy className="h-4 w-4" /></Button>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label className="flex items-center gap-2"><Settings className="h-4 w-4"/> Access Settings</Label>
                <Select value={accessLevel} onValueChange={(v: SharedLink['accessLevel']) => setAccessLevel(v)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="view">Can view</SelectItem>
                        <SelectItem value="comment">Can comment</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                 <div className="flex items-center space-x-2">
                    <Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword}/>
                    <Label htmlFor="use-password" className="flex items-center gap-2"><KeyRound className="h-4 w-4"/> Add Password</Label>
                </div>
                {usePassword && (
                    <Input placeholder="Enter a password" value={password === '********' ? '' : password} onChange={e => setPassword(e.target.value)} />
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center space-x-2">
                    <Switch id="use-expiration" checked={useExpiration} onCheckedChange={setUseExpiration}/>
                    <Label htmlFor="use-expiration" className="flex items-center gap-2"><CalendarIcon className="h-4 w-4"/> Set Expiration Date</Label>
                </div>
                {useExpiration && (
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expiresAt ? format(expiresAt, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={expiresAt}
                            onSelect={setExpiresAt}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                    </Popover>
                )}
            </div>

            <DialogFooter className='pt-4'>
                <Button variant="destructive" onClick={handleDisableLink} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Disable Link
                </Button>
                <Button onClick={handleUpdateLink} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Update Link
                </Button>
            </DialogFooter>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4 space-y-4">
            <div className="p-3 bg-secondary rounded-full">
                <Link className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No active link for this view. Create one to share it.</p>
            <Button onClick={handleCreateLink} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Create Shareable Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
