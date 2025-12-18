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
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { SharedLink, NavigationItem, Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar as CalendarIcon, Clock, type LucideIcon } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { defaultNavItems } from '@/lib/navigation-items';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return null;
  return <LucideIconComponent {...props} />;
};


// Define which nav items are shareable
const isShareable = (item: NavigationItem) => {
    const shareablePaths = ['/dashboard', '/tasks', '/calendar', '/schedule', '/social-media'];
    return shareablePaths.includes(item.path);
};


interface ShareViewDialogProps {
  children?: React.ReactNode;
}

export function ShareViewDialog({ children }: ShareViewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [linkName, setLinkName] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [permissions, setPermissions] = useState({
    canViewDetails: true,
    canComment: false,
    canChangeStatus: false,
    canEditContent: false,
    canAssignUsers: false,
  });

  // Get all navigation items relevant to the current user's role
  const userNavItems = useMemo(() => {
    if (!profile) return [];
    return defaultNavItems.filter(item => item.roles.includes(profile.role));
  }, [profile]);
  
  const shareableNavItems = useMemo(() => userNavItems.filter(isShareable), [userNavItems]);
  
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>([]);

  useEffect(() => {
    // Default selection logic when the dialog opens
    if (isOpen) {
      const defaultIds = shareableNavItems
        .filter(item => item.path === '/dashboard') // Always select dashboard by default if available
        .map(item => item.id);
      setSelectedNavIds(defaultIds);
    }
  }, [isOpen, shareableNavItems]);


  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    if (profile.role === 'Super Admin') {
        toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Super Admins cannot create share links.' });
        return;
    }

    setIsLoading(true);
    setGeneratedLink(null);

    try {
        // --- Create Data Snapshot ---
        let tasksQuery;
        if (profile.role === 'Manager') {
            tasksQuery = query(collection(firestore, 'tasks'), where('companyId', '==', profile.companyId), where('brandId', 'in', profile.brandIds || []));
        } else { // Employee, PIC, Client
            tasksQuery = query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
        }
        
        const [tasksSnap, statusesSnap, usersSnap, brandsSnap] = await Promise.all([
            getDocs(tasksQuery),
            getDocs(query(collection(firestore, 'statuses'), where('companyId', '==', profile.companyId))),
            getDocs(query(collection(firestore, 'users'), where('companyId', '==', profile.companyId))),
            getDocs(query(collection(firestore, 'brands'), where('companyId', '==', profile.companyId)))
        ]);

        const snapshot = {
            tasks: tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)),
            statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            users: usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
            brands: brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)),
        };

        // --- Create Link Data ---
        const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
          name: linkName || 'Shared View',
          companyId: profile.companyId,
          creatorRole: profile.role,
          brandIds: profile.brandIds || [],
          allowedNavItems: selectedNavIds, 
          navItems: userNavItems.map(item => ({...item, label: t(item.label as any)})), // Snapshot of translated nav items
          permissions,
          snapshot,
          createdBy: profile.id,
          ...(usePassword && { password }),
          ...(expiresAt && { expiresAt }),
        };

        const docRef = await addDoc(collection(firestore, 'sharedLinks'), {
            ...linkData,
            createdAt: serverTimestamp(),
        });

        const newLink = `${window.location.origin}/share/${docRef.id}`;
        setGeneratedLink(newLink);
        toast({ title: 'Share link created!' });
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    toast({ title: 'Link copied to clipboard!' });
  };
  
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setGeneratedLink(null);
      setUsePassword(false);
      setPassword('');
      setLinkName('');
      setExpiresAt(undefined);
      setPermissions({ canViewDetails: true, canComment: false, canChangeStatus: false, canEditContent: false, canAssignUsers: false });
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share View</DialogTitle>
          <DialogDescription>
            Create a public link to share a filtered view of your tasks.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
         <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-name">Link Name</Label>
                <Input id="link-name" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g., Q3 Client Preview" />
              </div>
              
              <div className="space-y-4 rounded-md border p-4">
                <h4 className="text-sm font-medium">Available Views</h4>
                <div className="space-y-2">
                    {shareableNavItems.map(item => (
                        <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={item.id}
                                checked={selectedNavIds.includes(item.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedNavIds(prev => 
                                        checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                                    );
                                }}
                            />
                            <label htmlFor={item.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                                <Icon name={item.icon} className="h-4 w-4 text-muted-foreground" />
                                {t(item.label as any)}
                            </label>
                        </div>
                    ))}
                </div>
              </div>

              <div className="space-y-4 rounded-md border p-4">
                  <h4 className="text-sm font-medium">Permissions for Viewer</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="perm-view" className="flex flex-col gap-1"><span>View Full Task Details</span><span className="font-normal text-xs text-muted-foreground">Allow viewers to open and see all task details.</span></Label>
                        <Switch id="perm-view" checked={permissions.canViewDetails} onCheckedChange={(c) => setPermissions(p => ({...p, canViewDetails: c}))} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="perm-comment" className="flex flex-col gap-1"><span>Allow Comments</span><span className="font-normal text-xs text-muted-foreground">Viewers can post comments as guests.</span></Label>
                        <Switch id="perm-comment" checked={permissions.canComment} onCheckedChange={(c) => setPermissions(p => ({...p, canComment: c}))} />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="perm-status" className="flex flex-col gap-1"><span>Allow Status Change</span><span className="font-normal text-xs text-muted-foreground">Allow viewers to drag-and-drop tasks on the board.</span></Label>
                        <Switch id="perm-status" checked={permissions.canChangeStatus} onCheckedChange={(c) => setPermissions(p => ({...p, canChangeStatus: c}))} />
                    </div>
                  </div>
              </div>

             <div className="space-y-4 rounded-md border p-4">
                <h4 className="text-sm font-medium">Access Control</h4>
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword} />
                        <Label htmlFor="use-password">Protect with password</Label>
                    </div>
                    {usePassword && (
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="Enter a password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                       <Clock className="h-4 w-4 text-muted-foreground" />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !expiresAt && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {expiresAt ? format(expiresAt, "PPP") : <span>Set expiration date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={expiresAt}
                                onSelect={setExpiresAt}
                                disabled={(date) => date < new Date()}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>
          </div>
         </ScrollArea>
        ) : (
          <div className="space-y-2 py-4">
            <Label htmlFor="share-link">Your Shareable Link</Label>
            <div className="flex items-center gap-2">
              <Input id="share-link" value={generatedLink} readOnly />
              <Button size="icon" variant="secondary" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
             <Button variant="outline" onClick={() => setIsOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={isLoading || selectedNavIds.length === 0}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Create Link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
