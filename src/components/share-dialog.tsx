
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
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, where, query, orderBy, deleteDoc, deleteField, arrayUnion } from 'firebase/firestore';
import type { SharedLink, NavigationItem, Brand } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, Settings, CalendarIcon, KeyRound, Loader2, X, Plus, Trash2, Shield, Eye, MessageSquare, Edit, UsersIcon, History } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { usePathname } from 'next/navigation';
import { Checkbox } from './ui/checkbox';
import { MultiSelect } from './ui/multi-select';

const defaultPermissions = {
  canViewDetails: true,
  canComment: false,
  canChangeStatus: false,
  canEditContent: false,
  canAssignUsers: false,
};

interface ShareDialogProps {
  creatorNavItems: NavigationItem[];
}

export function ShareDialog({ creatorNavItems }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLink, setActiveLink] = useState<SharedLink | null>(null);

  // Form state
  const [linkName, setLinkName] = useState('');
  
  // Security State
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<Date | undefined>();
  const [expiresAtTime, setExpiresAtTime] = useState<string>('00:00');

  // Permissions State
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [allowedNavItems, setAllowedNavItems] = useState<string[]>([]);
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [historyLink, setHistoryLink] = useState<SharedLink | null>(null);

  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();
  
  const linksQuery = useMemo(() => {
    if (!firestore || !profile?.companyId) return null;
    return query(collection(firestore, 'sharedLinks'), where('companyId', '==', profile.companyId));
  }, [firestore, profile?.companyId]);
  const { data: existingLinks, isLoading: isLinksLoading } = useCollection<SharedLink>(linksQuery);

  const brandsQuery = useMemo(() => {
    if (!firestore || !profile?.brandIds) return null;
    if (profile.role === 'Manager' && profile.brandIds.length === 0) return null;

    let q = query(collection(firestore, 'brands'), orderBy('name'));
    if (profile.role === 'Manager') {
        q = query(q, where('__name__', 'in', profile.brandIds));
    }
    return q;
  }, [firestore, profile]);
  const { data: manageableBrands } = useCollection<Brand>(brandsQuery);
  const brandOptions = useMemo(() => (manageableBrands || []).map(b => ({ value: b.id, label: b.name })), [manageableBrands]);


  const selectableSharePages = useMemo(() => {
    return creatorNavItems.filter(item => !!item.path && item.id !== 'nav_guide'); // Exclude Guide page
  }, [creatorNavItems]);


  useEffect(() => {
    if (!isOpen) {
      handleOpenNew();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!activeLink && !isLinksLoading && existingLinks && existingLinks.length > 0) {
        loadLinkDetails(existingLinks[0]);
    } else if (!activeLink && !isLinksLoading && (!existingLinks || existingLinks.length === 0)) {
        handleOpenNew();
    }
  }, [existingLinks, isLinksLoading, activeLink]);


  const handlePermissionChange = (permission: keyof typeof permissions, value: boolean) => {
    setPermissions(prev => ({ ...prev, [permission]: value }));
  };
  
  const handleAllowedNavItemChange = (navItemId: string, isChecked: boolean) => {
    setAllowedNavItems(prev => 
        isChecked ? [...prev, navItemId] : prev.filter(id => id !== navItemId)
    );
  };


  const handleOpenNew = () => {
    setActiveLink(null);
    setLinkName('');
    setUsePassword(false);
    setPassword('');
    setUseExpiration(false);
    setExpiresAtDate(undefined);
    setExpiresAtTime('00:00');
    setPermissions(defaultPermissions);
    setAllowedNavItems([]);
    setBrandIds([]);
  };
  
  const loadLinkDetails = (link: SharedLink) => {
    setActiveLink(link);
    setLinkName(link.name || (link.createdAt ? `Link from ${format(link.createdAt.toDate(), 'PP')}` : 'New Link'));
    
    if (link.password) {
      setUsePassword(true);
      setPassword('********');
    } else {
      setUsePassword(false);
      setPassword('');
    }

    if (link.expiresAt) {
      const expirationDate = (link.expiresAt as any).toDate();
      setUseExpiration(true);
      setExpiresAtDate(expirationDate);
      setExpiresAtTime(format(expirationDate, 'HH:mm'));
    } else {
      setUseExpiration(false);
      setExpiresAtDate(undefined);
      setExpiresAtTime('00:00');
    }

    setPermissions(link.permissions || defaultPermissions);
    setAllowedNavItems(link.allowedNavItems || []);
    setBrandIds(link.brandIds || []);
  };

  const getCombinedExpiration = () => {
    if (!useExpiration || !expiresAtDate) return null;
    const [hours, minutes] = expiresAtTime.split(':').map(Number);
    const combinedDate = new Date(expiresAtDate);
    combinedDate.setHours(hours, minutes);
    return combinedDate;
  };

  const handleCreateOrUpdateLink = async () => {
    if (!firestore || !profile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Core data not loaded. Please try again.' });
        return;
    };
    
    if (allowedNavItems.length === 0) {
        toast({ variant: 'destructive', title: 'Action Blocked', description: 'You must select at least one page to share.' });
        return;
    }

    setIsLoading(true);

    const isCreating = !activeLink;
    
    const linkData: Partial<Omit<SharedLink, 'id' | 'createdAt' | 'createdBy'>> = {
        name: linkName,
        permissions,
        allowedNavItems,
        companyId: profile.companyId,
        brandIds: brandIds,
    };

    if (usePassword && password) {
        if (password !== '********') {
            linkData.password = password;
        }
    } else if (!isCreating) {
        linkData.password = deleteField() as any;
    }

    if (useExpiration && expiresAtDate) {
        linkData.expiresAt = getCombinedExpiration() as any;
    } else if (!isCreating) {
        linkData.expiresAt = deleteField() as any;
    }
    
    try {
        if (activeLink) {
            const linkRef = doc(firestore, 'sharedLinks', activeLink.id);
            await updateDoc(linkRef, { ...linkData, updatedAt: serverTimestamp() });
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
                createdBy: profile.id,
                createdAt: serverTimestamp(),
            });
            const newLinkDoc = await getDoc(docRef);
            if (newLinkDoc.exists()){
                const newLink = newLinkDoc.data() as SharedLink;
                setActiveLink({ ...newLink, id: docRef.id });
                loadLinkDetails({ ...newLink, id: docRef.id });
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
  
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !activeLink) return '';
    return `${window.location.origin}/share/${activeLink.id}`;
  }, [activeLink]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link copied to clipboard!' });
  };
  
  const isLoadingAnything = isLoading || isProfileLoading || isLinksLoading;

  const PermissionSwitch = ({ id, label, description, checked, onCheckedChange, disabled = false }: {id: string, label: string, description: string, checked: boolean, onCheckedChange: (checked: boolean) => void, disabled?: boolean}) => (
    <div className="flex items-start justify-between space-x-2">
      <div className="flex-grow">
        <Label htmlFor={id} className={cn("font-medium", disabled && "text-muted-foreground")}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
  
   const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return format(dateObj, 'PP, p');
  };

  return (
    <>
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
              Generate a secure, permission-based link to share a snapshot of your current workspace view.
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
                              <div key={link.id} className="flex items-center justify-between rounded-md hover:bg-secondary">
                                <Button variant={activeLink?.id === link.id ? 'secondary' : 'ghost'} className="w-full justify-start text-left h-auto py-2" onClick={() => loadLinkDetails(link)}>
                                  <span className="truncate">{link.name || (link.createdAt ? `Link from ${format(link.createdAt.toDate(), 'PP')}` : 'New Link')}</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); setHistoryLink(link); }}>
                                    <History className="h-4 w-4" />
                                </Button>
                              </div>
                          ))}
                      </div>
                  </ScrollArea>
              </div>
              <ScrollArea className='col-span-3'>
                <div className="p-6 space-y-6">
                  {isLoadingAnything ? (
                      <div className="flex justify-center items-center h-96">
                          <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="link-name">Link Name</Label>
                        <Input id="link-name" value={linkName || ''} onChange={e => setLinkName(e.target.value)} placeholder="e.g. Q3 Report for Client" />
                      </div>

                      {profile?.role === 'Manager' && (
                        <Card>
                            <CardHeader>
                                <h3 className="font-semibold">Data Scope</h3>
                                <p className="text-sm text-muted-foreground">
                                    Choose which brands' data to include in this link.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <MultiSelect 
                                    options={brandOptions}
                                    onValueChange={setBrandIds}
                                    defaultValue={brandIds}
                                    placeholder="Select brands to share..."
                                />
                                <p className="text-xs text-muted-foreground mt-2">If no brands are selected, all brands you manage will be included.</p>
                            </CardContent>
                        </Card>
                      )}
                      
                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold">Visible Pages</h3>
                           <p className="text-sm text-muted-foreground">
                            Select which pages the recipient can access.
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-md">
                                {selectableSharePages.length > 0 ? selectableSharePages.map(item => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <Checkbox 
                                          id={`nav-${item.id}`} 
                                          checked={allowedNavItems.includes(item.id)}
                                          onCheckedChange={(checked) => handleAllowedNavItemChange(item.id, !!checked)}
                                        />
                                        <Label htmlFor={`nav-${item.id}`}>{item.label}</Label>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground text-center p-4">Your role does not have access to any shareable pages.</p>}
                            </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Label className="flex items-center gap-2"><Shield className="h-4 w-4"/> Permissions</Label>
                          <p className="text-sm text-muted-foreground pt-1">Control exactly what viewers can do within the shared pages.</p>
                        </CardHeader>
                        <CardContent className='space-y-5'>
                          <PermissionSwitch id="perm-view" label="View Full Task Details" description="Allows viewers to open tasks and see all fields." checked={permissions.canViewDetails} onCheckedChange={(val) => handlePermissionChange('canViewDetails', val)} />
                          <PermissionSwitch id="perm-comment" label="Comment on Tasks" description="Allows viewers to post comments." checked={permissions.canComment} onCheckedChange={(val) => handlePermissionChange('canComment', val)} />
                          <PermissionSwitch id="perm-status" label="Change Task Status" description="Allows viewers to drag-and-drop tasks between columns." checked={permissions.canChangeStatus} onCheckedChange={(val) => handlePermissionChange('canChangeStatus', val)} />
                          <PermissionSwitch id="perm-edit" label="Edit Task Content" description="Allows viewers to change title, description, dates, etc." checked={permissions.canEditContent} onCheckedChange={(val) => handlePermissionChange('canEditContent', val)} />
                          <PermissionSwitch id="perm-assign" label="Assign/Unassign Users" description="Allows viewers to change who is assigned to a task." checked={permissions.canAssignUsers} onCheckedChange={(val) => handlePermissionChange('canAssignUsers', val)} />
                        </CardContent>
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
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className='mr-2 h-4 w-4' />} Disable Link
                  </Button>
                )}
              </div>
              <Button onClick={handleCreateOrUpdateLink} disabled={isLoadingAnything || allowedNavItems.length === 0}>
                  {isLoadingAnything && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  {activeLink ? 'Update Link' : 'Create Link'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyLink} onOpenChange={() => setHistoryLink(null)}>
        <DialogContent>
          <DialogHeader>
              <DialogTitle>Link History: {historyLink?.name}</DialogTitle>
              <DialogDescription>Audit log for this shared link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
             <div className="flex justify-between">
                <span className="text-muted-foreground">Created By:</span>
                <span className="font-medium">{historyLink?.createdBy || 'Unknown User'}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-muted-foreground">Created At:</span>
                <span className="font-medium">{formatDate(historyLink?.createdAt)}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-medium">{historyLink?.updatedAt ? formatDate(historyLink?.updatedAt) : 'Never'}</span>
             </div>
              <Separator />
               <div>
                <h4 className="font-medium mb-2">Enabled Permissions</h4>
                <ul className="list-disc list-inside space-y-1">
                    {historyLink && Object.entries(historyLink.permissions).filter(([, value]) => value === true).map(([key]) => (
                        <li key={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</li>
                    ))}
                </ul>
              </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
