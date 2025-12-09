
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
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, deleteField, getDoc, where, query, orderBy } from 'firebase/firestore';
import type { SharedLink, User, Brand, Priority } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Users, Briefcase, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn, priorityInfo } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type TargetType = 'dashboard' | 'brand' | 'priority' | 'assignee';

export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLink, setActiveLink] = useState<SharedLink | null>(null);

  const [targetType, setTargetType] = useState<TargetType>('dashboard');
  const [targetId, setTargetId] = useState<string>('all');
  const [targetName, setTargetName] = useState<string>('Entire Dashboard');
  
  const [permissions, setPermissions] = useState<SharedLink['permissions']>({
    canViewDetails: true,
    canComment: false,
    canChangeStatus: false,
    canEditContent: false,
    canAssignUsers: false,
  });

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

  const brandsQuery = useMemo(() => (firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null), [firestore]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const usersQuery = useMemo(() => {
    if (!firestore || !profile?.companyId) return null; // Guard clause
    return query(collection(firestore, 'users'), where('companyId', '==', profile.companyId));
  }, [firestore, profile]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const priorityOptions = Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label }));

  useEffect(() => {
    const linkForCurrentTarget = existingLinks?.find(l => l.targetType === targetType && l.targetId === targetId);
    setActiveLink(linkForCurrentTarget || null);

    if (linkForCurrentTarget) {
      setPermissions(linkForCurrentTarget.permissions);
      setTargetName(linkForCurrentTarget.targetName);
      setUsePassword(!!linkForCurrentTarget.password);
      setPassword(linkForCurrentTarget.password ? '********' : '');
      if (linkForCurrentTarget.expiresAt) {
        const expirationDate = new Date(linkForCurrentTarget.expiresAt);
        setUseExpiration(true);
        setExpiresAtDate(expirationDate);
        setExpiresAtTime(format(expirationDate, 'HH:mm'));
      } else {
        setUseExpiration(false);
        setExpiresAtDate(undefined);
      }
    } else {
      // Reset to defaults when target changes and no link exists
      const defaultName = targetId === 'all' ? 'Entire Dashboard' : brands?.find(b => b.id === targetId)?.name || users?.find(u => u.id === targetId)?.name || targetId;
      setTargetName(defaultName || '');
      setPermissions({ canViewDetails: true, canComment: false, canChangeStatus: false, canEditContent: false, canAssignUsers: false });
      setUsePassword(false);
      setPassword('');
      setUseExpiration(false);
      setExpiresAtDate(undefined);
    }
  }, [targetType, targetId, existingLinks, brands, users]);
  
  useEffect(() => {
    if (targetType === 'dashboard') {
        setTargetId('all');
        setTargetName('Entire Dashboard');
    } else {
        setTargetId('');
        setTargetName('');
    }
  }, [targetType]);

  const handlePermissionChange = (key: keyof SharedLink['permissions'], value: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  const getCombinedExpiration = () => {
    if (!useExpiration || !expiresAtDate) return null;
    const [hours, minutes] = expiresAtTime.split(':').map(Number);
    const combinedDate = new Date(expiresAtDate);
    combinedDate.setHours(hours, minutes);
    return combinedDate.toISOString();
  };

  const handleCreateOrUpdateLink = async () => {
    if (!firestore || !profile) return;
    setIsLoading(true);

    const linkData = {
      targetType,
      targetId,
      targetName,
      permissions,
      companyId: profile.companyId,
      password: usePassword && password && password !== '********' ? password : (activeLink?.password || deleteField()),
      expiresAt: getCombinedExpiration() || deleteField(),
    };

    try {
      if (activeLink) {
        const linkRef = doc(firestore, 'sharedLinks', activeLink.id);
        await updateDoc(linkRef, linkData);
        toast({ title: 'Link updated!' });
      } else {
        const docRef = await addDoc(collection(firestore, 'sharedLinks'), { ...linkData, createdBy: profile.id, createdAt: serverTimestamp() });
        const newLink = (await getDoc(docRef)).data() as SharedLink;
        setActiveLink({ ...newLink, id: docRef.id });
        toast({ title: 'Share link created!' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Operation Failed' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDisableLink = async () => {
    if (!firestore || !activeLink) return;
    setIsLoading(true);
    try {
        await deleteDoc(doc(firestore, 'sharedLinks', activeLink.id));
        setActiveLink(null);
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
  
  const renderTargetSelector = () => {
    if (targetType === 'dashboard') {
        return (
             <Select value="all" disabled>
                <SelectTrigger>
                    <SelectValue>Entire Dashboard</SelectValue>
                </SelectTrigger>
            </Select>
        )
    }
    
    let options: { value: string, label: string }[] = [];
    if (targetType === 'brand') options = brands?.map(b => ({ value: b.id, label: b.name })) || [];
    if (targetType === 'priority') options = priorityOptions;
    if (targetType === 'assignee') options = users?.map(u => ({ value: u.id, label: u.name })) || [];
    
    return (
        <Select value={targetId} onValueChange={(v) => setTargetId(v)}>
            <SelectTrigger><SelectValue placeholder={`Select ${targetType}...`} /></SelectTrigger>
            <SelectContent>
                {(areBrandsLoading || areUsersLoading) && <div className='p-2'><Loader2 className="animate-spin h-4 w-4"/></div>}
                {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
        </Select>
    );
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
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Share View</DialogTitle>
          <DialogDescription>
            Generate a secure link to share a specific view of your workspace with granular permissions.
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
                    <CardTitle className='text-base'>Target</CardTitle>
                    <CardDescription>Choose what you want to share.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">Entire Dashboard</SelectItem>
                        <SelectItem value="brand">Tasks by Brand</SelectItem>
                        <SelectItem value="priority">Tasks by Priority</SelectItem>
                        <SelectItem value="assignee">Tasks by Assignee</SelectItem>
                      </SelectContent>
                    </Select>
                    {renderTargetSelector()}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Permissions</CardTitle>
                    <CardDescription>Control what recipients can see and do.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between"><Label htmlFor="perm-view">View Full Task Details</Label><Switch id="perm-view" checked={permissions.canViewDetails} onCheckedChange={(v) => handlePermissionChange('canViewDetails', v)} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="perm-comment">Add Comments</Label><Switch id="perm-comment" checked={permissions.canComment} onCheckedChange={(v) => handlePermissionChange('canComment', v)} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="perm-status">Change Task Status</Label><Switch id="perm-status" checked={permissions.canChangeStatus} onCheckedChange={(v) => handlePermissionChange('canChangeStatus', v)} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="perm-edit">Edit Content (Title, Desc.)</Label><Switch id="perm-edit" checked={permissions.canEditContent} onCheckedChange={(v) => handlePermissionChange('canEditContent', v)} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="perm-assign">Assign Users</Label><Switch id="perm-assign" checked={permissions.canAssignUsers} onCheckedChange={(v) => handlePermissionChange('canAssignUsers', v)} /></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4"/> Security Options</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-6'>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2"><Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword}/><Label htmlFor="use-password">Require Password</Label></div>
                      {usePassword && <Input placeholder="Enter a password" value={password === '********' ? '' : password} onChange={e => setPassword(e.target.value)} type='password'/>}
                    </div>
                    <Separator/>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2"><Switch id="use-expiration" checked={useExpiration} onCheckedChange={setUseExpiration}/><Label htmlFor="use-expiration">Set Expiration Date</Label></div>
                      {useExpiration && (
                        <div className="grid grid-cols-2 gap-2">
                          <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("justify-start text-left font-normal", !expiresAtDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{expiresAtDate ? format(expiresAtDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={expiresAtDate} onSelect={setExpiresAtDate} disabled={(date) => date < new Date()} initialFocus /></PopoverContent></Popover>
                          <Input type="time" value={expiresAtTime} onChange={e => setExpiresAtTime(e.target.value)}/>
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
        <DialogFooter className='p-6 pt-4 border-t flex justify-between w-full'>
            {activeLink ? (
                <Button variant="destructive" onClick={handleDisableLink} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className='mr-2' />} Disable Link
                </Button>
            ) : <div></div>}
            <Button onClick={handleCreateOrUpdateLink} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {activeLink ? 'Update Link' : 'Create Link'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
