
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
import type { SharedLink, Brand, User } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Eye, MessageSquare, Edit, Folder, Star, User as UserIcon, Workflow } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, where, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { priorityInfo } from '@/lib/utils';

type Permission = "canViewTasks" | "canViewDetails" | "canComment" | "canChangeStatus" | "canEditContent" | "canAssignUsers";
const allPermissions: {key: Permission, label: string, description: string}[] = [
    { key: 'canViewTasks', label: 'View Task List', description: 'Can see the list of tasks.' },
    { key: 'canViewDetails', label: 'View Full Details', description: 'Can open tasks to see description, subtasks, etc.' },
    { key: 'canComment', label: 'Add Comments', description: 'Can participate in discussions on tasks.' },
    { key: 'canChangeStatus', label: 'Change Status', description: 'Can move tasks between columns (e.g., "To Do" to "Doing").' },
    { key: 'canEditContent', label: 'Edit Content', description: 'Can change task titles and descriptions.' },
    { key: 'canAssignUsers', label: 'Assign Users', description: 'Can assign or unassign users from tasks.' },
];


export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdLink, setCreatedLink] = useState<SharedLink | null>(null);
  
  const [targetType, setTargetType] = useState<SharedLink['targetType']>('dashboard');
  const [targetId, setTargetId] = useState<string>('dashboard');
  const [targetName, setTargetName] = useState<string>('Entire Dashboard');

  const [permissions, setPermissions] = useState<SharedLink['permissions']>({ canViewTasks: true });
  
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | undefined>();
  const [expiresAtTime, setExpiresAtTime] = useState<string>('00:00');

  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const pathname = usePathname();
  const { toast } = useToast();

  const brandsQuery = useMemo(() => firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null, [firestore]);
  const { data: allBrands } = useCollection<Brand>(brandsQuery);

  const usersQuery = useMemo(() => firestore ? query(collection(firestore, 'users'), orderBy('name')) : null, [firestore]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  const priorityOptions = Object.values(priorityInfo);

  const linksQuery = useMemo(() => {
      if (!firestore || !profile) return null;
      // For now, only query for dashboard links as it's the only supported type
      return query(
          collection(firestore, 'sharedLinks'),
          where('companyId', '==', profile.companyId),
          where('targetType', '==', 'dashboard')
      )
  }, [firestore, profile]);

  const { data: existingLinks, isLoading: isLinksLoading } = useCollection<SharedLink>(linksQuery);

  const activeLink = useMemo(() => {
      if (existingLinks && existingLinks.length > 0) {
          return existingLinks.find(l => l.targetId === targetId);
      }
      return null;
  }, [existingLinks, targetId]);

  useEffect(() => {
    if (activeLink) {
        setCreatedLink(activeLink);
        setPermissions(activeLink.permissions || { canViewTasks: true });
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
        setCreatedLink(null);
    }
  }, [activeLink]);
  
  const handlePermissionChange = (permission: Permission, value: boolean) => {
    setPermissions(prev => ({...prev, [permission]: value}));
  };

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
      targetType,
      targetId,
      targetName,
      permissions,
      createdBy: profile.id,
      companyId: profile.companyId,
    };
    
    if (usePassword && password && password !== '********') {
        linkData.password = password;
    }

    const expiration = getCombinedExpiration();
    if (expiration) {
        linkData.expiresAt = expiration;
    } else {
        linkData.expiresAt = undefined;
    }
    
    // Clear undefined fields before sending to Firestore
    Object.keys(linkData).forEach(key => linkData[key as keyof typeof linkData] === undefined && delete linkData[key as keyof typeof linkData]);


    try {
      if (createdLink) {
        // Update existing link
        const linkRef = doc(firestore, 'sharedLinks', createdLink.id);
        await updateDoc(linkRef, linkData);
        toast({ title: 'Link updated successfully!' });
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
        setPermissions({ canViewTasks: true });
        setUsePassword(false);
        setPassword('');
        setUseExpiration(false);
        setExpiresAtDate(undefined);
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
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Create Collaborative View</DialogTitle>
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
                <CardTitle className='text-base flex items-center gap-2'><Folder className="h-4 w-4"/> What to share?</CardTitle>
                <CardDescription>Select the specific part of your workspace you want to share.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Select value={targetType} onValueChange={(v) => setTargetType(v as SharedLink['targetType'])}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Entire Dashboard</SelectItem>
                    <SelectItem value="brand" disabled>Tasks by Brand</SelectItem>
                    <SelectItem value="priority" disabled>Tasks by Priority</SelectItem>
                    <SelectItem value="assignee" disabled>Tasks by Assignee</SelectItem>
                  </SelectContent>
                </Select>
                 <Select disabled={targetType === 'dashboard'}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select target..."/>
                    </SelectTrigger>
                 </Select>
              </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4"/> Permissions</CardTitle>
                    <CardDescription>Control what people with the link can do.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {allPermissions.map(({ key, label, description }) => (
                    <div key={key} className="flex items-start space-x-3">
                      <Switch 
                        id={`perm-${key}`} 
                        checked={permissions[key as keyof typeof permissions] || false}
                        onCheckedChange={(checked) => handlePermissionChange(key, checked)}
                      />
                      <div className='grid gap-1.5 leading-none -mt-1'>
                        <Label htmlFor={`perm-${key}`} className='cursor-pointer'>{label}</Label>
                        <p className='text-xs text-muted-foreground'>{description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
             </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4"/> Security</CardTitle>
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
