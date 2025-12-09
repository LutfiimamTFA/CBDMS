'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import type { SharedLink, User } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Users, Briefcase } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const availableRoles = ['Manager', 'Employee', 'Client'] as const;
type SharedRole = (typeof availableRoles)[number];

export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<SharedLink | null>(null);
  
  const [sharedAsRole, setSharedAsRole] = useState<SharedRole>('Client');
  const [targetName, setTargetName] = useState<string>('Client Access Link');

  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | undefined>();
  const [expiresAtTime, setExpiresAtTime] = useState<string>('00:00');

  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();

  const linksQuery = useMemo(() => {
      if (!firestore || !profile) return null;
      return query(
          collection(firestore, 'sharedLinks'),
          where('companyId', '==', profile.companyId),
          // We can't filter by role directly in the query as it might not exist
          // We will filter client-side for now
      )
  }, [firestore, profile]);

  const { data: existingLinks, isLoading: isLinksLoading } = useCollection<SharedLink>(linksQuery);

  // Find the active link based on the selected role
  const activeLink = useMemo(() => {
      if (existingLinks && existingLinks.length > 0) {
          return existingLinks.find(l => l.sharedAsRole === sharedAsRole);
      }
      return null;
  }, [existingLinks, sharedAsRole]);


  // Effect to sync UI state when activeLink changes (e.g., when user selects a different role)
  useEffect(() => {
    if (activeLink) {
        setCreatedLink(activeLink);
        setTargetName(activeLink.targetName || `${activeLink.sharedAsRole} Access Link`);
        setPassword(activeLink.password ? '********' : '');
        setUsePassword(!!activeLink.password);
        
        if (activeLink.expiresAt) {
            const expirationDate = new Date(activeLink.expiresAt);
            setExpiresAtDate(expirationDate);
            setExpiresAtTime(format(expirationDate, 'HH:mm'));
            setUseExpiration(true);
        } else {
            setUseExpiration(false);
        }
    } else {
        // Reset to default state if no link exists for the selected role
        setCreatedLink(null);
        setTargetName(`${sharedAsRole} Access Link`);
        setPassword('');
        setUsePassword(false);
        setExpiresAtDate(undefined);
        setExpiresAtTime('00:00');
        setUseExpiration(false);
    }
  }, [activeLink, sharedAsRole]);
  

  const getCombinedExpiration = () => {
    if (!useExpiration || !expiresAtDate) return undefined;
    const [hours, minutes] = expiresAtTime.split(':').map(Number);
    const combinedDate = new Date(expiresAtDate);
    combinedDate.setHours(hours, minutes);
    return combinedDate.toISOString();
  }

  const handleCreateOrUpdateLink = async () => {
    if (!firestore || !profile) return;

    setIsLoading(true);
    
    if (usePassword && !password) {
        toast({ variant: 'destructive', title: 'Password required' });
        setIsLoading(false);
        return;
    }
    
    const linkData: Partial<SharedLink> = {
      sharedAsRole,
      targetName,
      createdBy: profile.id,
      companyId: profile.companyId,
    };
    
    if (usePassword && password && password !== '********') {
        linkData.password = password; // In a real app, hash this!
    }

    const expiration = getCombinedExpiration();
    if (expiration) {
        linkData.expiresAt = expiration;
    } else if (createdLink && createdLink.expiresAt) {
        // If expiration is disabled on an existing link, remove the field
        linkData.expiresAt = deleteField() as any;
    }
    
    try {
      if (createdLink) {
        // Update existing link
        const linkRef = doc(firestore, 'sharedLinks', createdLink.id);
        await updateDoc(linkRef, linkData);
        toast({ title: 'Link updated successfully!' });
        // Manually update local state to reflect change immediately
        setCreatedLink(prev => prev ? { ...prev, ...linkData } as SharedLink : null);
      } else {
        // Create new link
        linkData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(firestore, 'sharedLinks'), linkData);
        setCreatedLink({ ...linkData, id: docRef.id, createdAt: new Date() } as SharedLink);
        toast({ title: 'Share link created!' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Operation Failed', description: 'Could not save the link.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableLink = async () => {
    if (!firestore || !createdLink) return;
    setIsLoading(true);
    try {
        await deleteDoc(doc(firestore, 'sharedLinks', createdLink.id));
        setCreatedLink(null);
        // Reset state
        setPassword('');
        setUsePassword(false);
        setExpiresAtDate(undefined);
        setUseExpiration(false);
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
      <DialogContent className="sm:max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Create Shared Role View</DialogTitle>
          <DialogDescription>
            Generate a secure link that simulates a specific user role, providing a complete but controlled user experience.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className='px-6'>
        <div className="py-4 space-y-6">
        {isLoadingAnything ? (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className='text-base flex items-center gap-2'><Users className="h-4 w-4"/> Share As Role</CardTitle>
                <CardDescription>Select the role you want to simulate for the person using this link.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={sharedAsRole} onValueChange={(v) => setSharedAsRole(v as SharedRole)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {availableRoles.map(role => (
                       <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Label htmlFor="link-name">Link Name (Optional)</Label>
                  <Input id="link-name" value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="e.g., Client Preview Link"/>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4"/> Security Options</CardTitle>
                <CardDescription>Add extra layers of security to your shared link.</CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                 <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                       <Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword}/>
                       <Label htmlFor="use-password" className="font-semibold cursor-pointer">Require Password</Label>
                    </div>
                    {usePassword && (
                        <Input placeholder="Enter a password" value={password === '********' ? '' : password} onChange={e => setPassword(e.target.value)} type='password'/>
                    )}
                 </div>
                 <Separator/>
                 <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                       <Switch id="use-expiration" checked={useExpiration} onCheckedChange={setUseExpiration}/>
                       <Label htmlFor="use-expiration" className="font-semibold cursor-pointer">Set Expiration</Label>
                    </div>
                    {useExpiration && (
                       <div className="grid grid-cols-2 gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn("justify-start text-left font-normal", !expiresAtDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {expiresAtDate ? format(expiresAtDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={expiresAtDate}
                                onSelect={setExpiresAtDate}
                                disabled={(date) => date < new Date()}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <Input
                            type="time"
                            value={expiresAtTime}
                            onChange={e => setExpiresAtTime(e.target.value)}
                        />
                       </div>
                    )}
                 </div>
              </CardContent>
            </Card>

            {createdLink && (
              <div className="space-y-2 pt-4">
                  <Label htmlFor="share-link">Your Shareable Link</Label>
                  <div className="flex items-center gap-2">
                      <Input id="share-link" value={shareUrl} readOnly />
                      <Button size="icon" variant="secondary" onClick={copyToClipboard}><Copy className="h-4 w-4" /></Button>
                  </div>
              </div>
            )}
          </>
        )}
        </div>
        </ScrollArea>
        <DialogFooter className='p-6 pt-4 border-t flex justify-between w-full'>
            {createdLink ? (
                <Button variant="destructive" onClick={handleDisableLink} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className='mr-2' />} Disable Link
                </Button>
            ) : <div></div>}
            <Button onClick={handleCreateOrUpdateLink} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {createdLink ? 'Update Link' : 'Create Link'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
