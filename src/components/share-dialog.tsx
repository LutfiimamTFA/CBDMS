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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, where, query, orderBy, deleteDoc } from 'firebase/firestore';
import type { SharedLink } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLink, setActiveLink] = useState<SharedLink | null>(null);

  const [linkName, setLinkName] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | undefined>();
  const [expiresAtTime, setExpiresAtTime] = useState<string>('00:00');

  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();
  
  const linksQuery = useMemo(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'sharedLinks'), where('companyId', '==', profile.companyId));
  }, [firestore, profile]);
  const { data: existingLinks, isLoading: isLinksLoading } = useCollection<SharedLink>(linksQuery);

  // This effect now correctly handles initialization without overriding user actions.
  useEffect(() => {
    // Only auto-select the first link if no link is currently active
    // and the list of links has loaded and is not empty.
    if (!activeLink && existingLinks && existingLinks.length > 0) {
      loadLinkDetails(existingLinks[0]);
    }
  }, [existingLinks, activeLink]); // Depend on existingLinks and activeLink

  const handleOpenNew = () => {
    setActiveLink(null);
    setLinkName('');
    setUsePassword(false);
    setPassword('');
    setUseExpiration(false);
    setExpiresAtDate(undefined);
    setExpiresAtTime('00:00');
  };
  
  const loadLinkDetails = (link: SharedLink) => {
    setActiveLink(link);
    setLinkName(link.name || `Link from ${format(link.createdAt.toDate(), 'PP')}`);
    if (link.password) {
      setUsePassword(true);
      setPassword('********');
    } else {
      setUsePassword(false);
      setPassword('');
    }
    if (link.expiresAt) {
      const expirationDate = new Date(link.expiresAt);
      setUseExpiration(true);
      setExpiresAtDate(expirationDate);
      setExpiresAtTime(format(expirationDate, 'HH:mm'));
    } else {
      setUseExpiration(false);
      setExpiresAtDate(undefined);
      setExpiresAtTime('00:00');
    }
  };

  const getCombinedExpiration = () => {
    if (!useExpiration || !expiresAtDate) return null;
    const [hours, minutes] = expiresAtTime.split(':').map(Number);
    const combinedDate = new Date(expiresAtDate);
    combinedDate.setHours(hours, minutes);
    return combinedDate.toISOString();
  };

  const handleCreateOrUpdateLink = async () => {
    if (!firestore || !profile) {
        toast({ variant: 'destructive', title: 'Error', description: 'User profile not loaded.' });
        return;
    };
    setIsLoading(true);

    const linkData: any = {
        name: linkName,
        companyId: profile.companyId,
        sharedAsRole: profile.role,
        createdBy: profile.id,
    };

    if (usePassword && password) {
        if (password !== '********') {
            linkData.password = password;
        }
    } else {
        linkData.password = null; // Explicitly set to null for Firestore
    }

    if (useExpiration && expiresAtDate) {
        linkData.expiresAt = getCombinedExpiration();
    } else {
        linkData.expiresAt = null; // Explicitly set to null
    }

    try {
        if (activeLink) {
            // Update existing link
            const linkRef = doc(firestore, 'sharedLinks', activeLink.id);
            // Don't overwrite createdBy and createdAt on update
            const { createdBy, createdAt, ...updateData } = linkData; 
            await updateDoc(linkRef, updateData);
            
            toast({ title: 'Link updated!' });
            const updatedLinkDoc = await getDoc(linkRef);
            if (updatedLinkDoc.exists()) {
                const updatedLink = updatedLinkDoc.data() as SharedLink;
                setActiveLink({ ...updatedLink, id: updatedLinkDoc.id });
            }

        } else {
            // Create new link
            const docRef = await addDoc(collection(firestore, 'sharedLinks'), {
                ...linkData,
                createdAt: serverTimestamp(),
            });
            const newLinkDoc = await getDoc(docRef);
            if (newLinkDoc.exists()){
                const newLink = newLinkDoc.data() as SharedLink;
                setActiveLink({ ...newLink, id: docRef.id });
            }
            toast({ title: 'Share link created!' });
        }
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message || "An unknown error occurred." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDisableLink = async () => {
    if (!firestore || !activeLink) return;
    setIsLoading(true);
    try {
        await deleteDoc(doc(firestore, 'sharedLinks', activeLink.id));
        handleOpenNew(); // Reset to "Create New" view
        toast({ title: 'Share link disabled' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Failed to disable link' });
    } finally {
        setIsLoading(false);
    }
  };
  
  const shareUrl = activeLink ? `${window.location.origin}/share/${activeLink.id}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link copied to clipboard!' });
  };
  
  const isLoadingAnything = isLoading || isProfileLoading || isLinksLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(val) => {setIsOpen(val); if (!val) handleOpenNew()}}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Share View</DialogTitle>
          <DialogDescription>
            Generate a secure link to share a live view of your workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-4 h-full overflow-hidden">
            <div className="col-span-1 border-r h-full flex flex-col">
                <div className="p-2">
                    <Button variant="ghost" className="w-full justify-start mb-2" onClick={handleOpenNew}>
                      <Plus className="mr-2 h-4 w-4"/> Create New Link
                    </Button>
                </div>
                <Separator />
                <ScrollArea className="flex-1">
                    <div className="p-2">
                        {isLinksLoading ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5"/></div>
                        ) : (existingLinks || []).map(link => (
                            <Button key={link.id} variant={activeLink?.id === link.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => loadLinkDetails(link)}>
                                {link.name || `Link from ${format(link.createdAt.toDate(), 'PP')}`}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <ScrollArea className='col-span-3'>
              <div className="p-6 space-y-6">
                {isLoadingAnything ? (
                    <div className="flex justify-center items-center h-96">
                        <Loader2 className="animate-spin h-8 w-8" />
                    </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="link-name">Link Name</Label>
                      <Input id="link-name" value={linkName || ''} onChange={e => setLinkName(e.target.value)} placeholder="e.g. Q3 Report for Client" />
                    </div>
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold">Shared Experience</h3>
                        <div className="text-sm text-muted-foreground">The generated link will provide a view consistent with the <Badge variant="outline">{activeLink?.sharedAsRole || profile?.role}</Badge> role.</div>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader>
                        <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4"/> Security Options</Label>
                      </CardHeader>
                      <CardContent className='space-y-6'>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2"><Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword}/><Label htmlFor="use-password">Require Password</Label></div>
                          {usePassword && <Input placeholder="Enter a password" value={password || ''} onChange={e => setPassword(e.target.value)} type='password'/>}
                        </div>
                        <Separator/>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2"><Switch id="use-expiration" checked={useExpiration} onCheckedChange={setUseExpiration}/><Label htmlFor="use-expiration">Set Expiration Date</Label></div>
                          {useExpiration && (
                            <div className="grid grid-cols-2 gap-2">
                              <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start text-left font-normal", !expiresAtDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{expiresAtDate ? format(expiresAtDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={expiresAtDate} onSelect={setExpiresAtDate} disabled={(date) => date < new Date()} initialFocus /></PopoverContent></Popover>
                              <Input type="time" value={expiresAtTime || ''} onChange={e => setExpiresAtTime(e.target.value)}/>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {activeLink && (
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
        </div>
        <DialogFooter className='p-6 pt-4 border-t flex justify-between w-full'>
            <div>
              {activeLink && (
                <Button variant="destructive" onClick={handleDisableLink} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className='mr-2' />} Disable Link
                </Button>
              )}
            </div>
            <Button onClick={handleCreateOrUpdateLink} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {activeLink ? 'Update Link' : 'Create Link'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
