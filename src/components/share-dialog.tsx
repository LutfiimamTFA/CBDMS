
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
import { useFirestore, useUserProfile, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, where, query, orderBy, deleteDoc, deleteField } from 'firebase/firestore';
import type { SharedLink, Brand, User } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Plus, Trash2, Shield, Eye, MessageSquare, Edit, UsersIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const defaultPermissions = {
  canViewDetails: true,
  canComment: false,
  canChangeStatus: false,
  canEditContent: false,
  canAssignUsers: false,
};

export function ShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLink, setActiveLink] = useState<SharedLink | null>(null);

  // Form state
  const [linkName, setLinkName] = useState('');
  const [targetType, setTargetType] = useState<'dashboard' | 'brand' | 'priority' | 'assignee'>('dashboard');
  const [targetId, setTargetId] = useState<string | null>('dashboard');

  // Security State
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | undefined>();
  const [expiresAtTime, setExpiresAtTime] = useState<string>('00:00');

  // Permissions State
  const [permissions, setPermissions] = useState(defaultPermissions);

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

  const usersQuery = useMemo(() => (firestore ? query(collection(firestore, 'users'), where('companyId', '==', profile?.companyId)) : null), [firestore, profile]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  useEffect(() => {
    if (!isOpen) {
      handleOpenNew();
    }
  }, [isOpen]);

  const handlePermissionChange = (permission: keyof typeof permissions, value: boolean) => {
    setPermissions(prev => ({ ...prev, [permission]: value }));
  };

  const handleOpenNew = () => {
    setActiveLink(null);
    setLinkName('');
    setTargetType('dashboard');
    setTargetId('dashboard');
    setUsePassword(false);
    setPassword('');
    setUseExpiration(false);
    setExpiresAtDate(undefined);
    setExpiresAtTime('00:00');
    setPermissions(defaultPermissions);
  };
  
  const loadLinkDetails = (link: SharedLink) => {
    setActiveLink(link);
    setLinkName(link.name || `Link from ${format(link.createdAt.toDate(), 'PP')}`);
    setTargetType(link.targetType);
    setTargetId(link.targetId);
    
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

    setPermissions(link.permissions || defaultPermissions);
  };

  const getCombinedExpiration = () => {
    if (!useExpiration || !expiresAtDate) return null;
    const [hours, minutes] = expiresAtTime.split(':').map(Number);
    const combinedDate = new Date(expiresAtDate);
    combinedDate.setHours(hours, minutes);
    return combinedDate.toISOString();
  };

  const getTargetName = () => {
      if (targetType === 'dashboard') return 'Entire Dashboard';
      if (targetType === 'brand') return brands?.find(b => b.id === targetId)?.name || 'Unknown Brand';
      if (targetType === 'priority') return targetId;
      if (targetType === 'assignee') return users?.find(u => u.id === targetId)?.name || 'Unknown User';
      return 'Unknown Target';
  }

  const handleCreateOrUpdateLink = async () => {
    if (!firestore || !profile) {
        toast({ variant: 'destructive', title: 'Error', description: 'User profile not loaded.' });
        return;
    };
    setIsLoading(true);

    const isCreating = !activeLink;

    const linkData: any = {
        name: linkName,
        sharedAsRole: profile.role,
        targetType,
        targetId,
        targetName: getTargetName(),
        permissions,
        ...(isCreating && { companyId: profile.companyId }),
        ...(isCreating && { createdBy: profile.id }),
    };

    if (usePassword && password) {
        if (password !== '********') {
            linkData.password = password;
        }
    } else if (!isCreating) {
        linkData.password = deleteField();
    }

    if (useExpiration && expiresAtDate) {
        linkData.expiresAt = getCombinedExpiration();
    } else if (!isCreating) {
        linkData.expiresAt = deleteField();
    }
    
    try {
        if (activeLink) {
            const linkRef = doc(firestore, 'sharedLinks', activeLink.id);
            await updateDoc(linkRef, linkData);
            toast({ title: 'Link updated!' });
            const updatedLinkDoc = await getDoc(linkRef);
            if (updatedLinkDoc.exists()) {
                const updatedData = updatedLinkDoc.data() as SharedLink;
                setActiveLink({ ...updatedData, id: updatedLinkDoc.id });
                loadLinkDetails({ ...updatedData, id: updatedLinkDoc.id });
            }
        } else {
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
        handleOpenNew();
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
  
  const isLoadingAnything = isLoading || isProfileLoading || isLinksLoading || areBrandsLoading || areUsersLoading;

  const renderTargetSelect = () => {
    switch(targetType) {
        case 'brand':
            return <Select value={targetId || ''} onValueChange={setTargetId}><SelectTrigger><SelectValue placeholder="Select a brand..." /></SelectTrigger><SelectContent>{brands?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>;
        case 'priority':
            return <Select value={targetId || ''} onValueChange={setTargetId}><SelectTrigger><SelectValue placeholder="Select a priority..." /></SelectTrigger><SelectContent>{['Urgent', 'High', 'Medium', 'Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>;
        case 'assignee':
            return <Select value={targetId || ''} onValueChange={setTargetId}><SelectTrigger><SelectValue placeholder="Select a user..." /></SelectTrigger><SelectContent>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>;
        case 'dashboard':
        default:
            return <Input value="Entire Dashboard" readOnly disabled />;
    }
  };

  const PermissionSwitch = ({ id, label, description, checked, onCheckedChange }: {id: string, label: string, description: string, checked: boolean, onCheckedChange: (checked: boolean) => void}) => (
    <div className="flex items-start justify-between space-x-2">
      <div className="flex-grow">
        <Label htmlFor={id} className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            Generate a secure, permission-based link to share a live view of your workspace.
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
                            <h3 className="font-semibold">What to Share</h3>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <Select value={targetType} onValueChange={(val) => setTargetType(val as any)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dashboard">Entire Dashboard</SelectItem>
                                    <SelectItem value="brand">Tasks by Brand</SelectItem>
                                    <SelectItem value="priority">Tasks by Priority</SelectItem>
                                    <SelectItem value="assignee">Tasks by Assignee</SelectItem>
                                </SelectContent>
                            </Select>
                            {renderTargetSelect()}
                        </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Label className="flex items-center gap-2"><Shield className="h-4 w-4"/> Permissions</Label>
                        <p className="text-sm text-muted-foreground pt-1">Control exactly what viewers can do with this link.</p>
                      </CardHeader>
                      <CardContent className='space-y-5'>
                        <PermissionSwitch id="perm-view" label="View Full Task Details" description="Allows viewers to open tasks and see all fields." checked={permissions.canViewDetails} onCheckedChange={(val) => handlePermissionChange('canViewDetails', val)} />
                        <PermissionSwitch id="perm-comment" label="Comment on Tasks" description="Allows viewers to post comments and mention users." checked={permissions.canComment} onCheckedChange={(val) => handlePermissionChange('canComment', val)} />
                        <PermissionSwitch id="perm-status" label="Change Task Status" description="Allows viewers to drag-and-drop tasks between columns." checked={permissions.canChangeStatus} onCheckedChange={(val) => handlePermissionChange('canChangeStatus', val)} />
                        <PermissionSwitch id="perm-edit" label="Edit Task Content" description="Allows viewers to change title, description, dates, etc." checked={permissions.canEditContent} onCheckedChange={(val) => handlePermissionChange('canEditContent', val)} />
                        <PermissionSwitch id="perm-assign" label="Assign/Unassign Users" description="Allows viewers to change who is assigned to a task." checked={permissions.canAssignUsers} onCheckedChange={(val) => handlePermissionChange('canAssignUsers', val)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4"/> Security</Label>
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
