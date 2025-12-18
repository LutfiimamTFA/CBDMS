
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
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import type { SharedLink, Brand } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar, Users, Star, KanbanSquare, ClipboardList } from 'lucide-react';
import { MultiSelect } from '../ui/multi-select';
import { usePathname } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';

const navConfig = {
    '/dashboard': { id: 'nav_task_board', label: 'Kanban Board', icon: KanbanSquare },
    '/tasks': { id: 'nav_list', label: 'Task List', icon: ClipboardList },
    '/calendar': { id: 'nav_calendar', label: 'Big Calendar', icon: Calendar },
    '/schedule': { id: 'nav_schedule', label: 'Schedule', icon: Calendar },
    '/social-media': { id: 'nav_social_media_calendar', label: 'Social Media Calendar', icon: Calendar },
};

interface ShareViewDialogProps {
  children?: React.ReactNode;
}

export function ShareViewDialog({ children }: ShareViewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  const pathname = usePathname();
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  
  // Form state
  const [linkName, setLinkName] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [allowedNavItems, setAllowedNavItems] = useState<string[]>([]);
  const [permissions, setPermissions] = useState({
    canViewDetails: true,
    canComment: false,
    canChangeStatus: false,
    canEditContent: false,
    canAssignUsers: false,
  });
  
  const brandsQuery = useMemo(() => {
      if (!firestore || !profile) return null;
      let q = query(collection(firestore, 'brands'), orderBy('name'));
      if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
        q = query(q, where('__name__', 'in', profile.brandIds));
      }
      return q;
  }, [firestore, profile]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(profile?.brandIds || []);
  
  useEffect(() => {
    if (isOpen) {
        const currentNav = Object.values(navConfig).find(nav => nav.id === (navConfig as any)[pathname]?.id);
        setAllowedNavItems(currentNav ? [currentNav.id] : []);
        setSelectedBrandIds(profile?.brandIds || []);
    }
  }, [isOpen, pathname, profile]);

  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    if (profile.role === 'Super Admin') {
        toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Super Admins cannot create share links.' });
        return;
    }
    if (allowedNavItems.length === 0) {
        toast({ variant: 'destructive', title: 'No Views Selected', description: 'Please select at least one view to share.' });
        return;
    }
    setIsLoading(true);
    setGeneratedLink(null);

    const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
      name: linkName || 'Shared View',
      companyId: profile.companyId,
      creatorRole: profile.role,
      allowedNavItems,
      permissions,
      brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : profile.brandIds,
      createdBy: profile.id,
      ...(usePassword && { password }),
    };

    try {
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
      setPermissions({ canViewDetails: true, canComment: false, canChangeStatus: false, canEditContent: false, canAssignUsers: false });
    }
  }, [isOpen]);

  const brandOptions = useMemo(() => (brands || []).map(b => ({ value: b.id, label: b.name })), [brands]);

  const isManager = profile?.role === 'Manager';
  const showBrandFilter = isManager && brandOptions.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share View</DialogTitle>
          <DialogDescription>
            Create a public link to share the current view with specific filters and permissions.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-name">Link Name</Label>
                <Input id="link-name" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g., Q3 Client Preview" />
              </div>
              
              {showBrandFilter && (
                <div className="space-y-2">
                  <Label>Data Scope (Brands)</Label>
                  <MultiSelect options={brandOptions} onValueChange={setSelectedBrandIds} defaultValue={selectedBrandIds} placeholder="Defaults to all your brands"/>
                </div>
              )}
              
               <div className="space-y-4 rounded-md border p-4">
                  <h4 className="text-sm font-medium">Available Views</h4>
                  <div className="space-y-3">
                    {Object.values(navConfig).map(nav => (
                       <div key={nav.id} className="flex items-center gap-3">
                         <Checkbox 
                           id={`nav-${nav.id}`} 
                           checked={allowedNavItems.includes(nav.id)}
                           onCheckedChange={(checked) => {
                             setAllowedNavItems(prev => 
                               checked ? [...prev, nav.id] : prev.filter(id => id !== nav.id)
                             )
                           }}
                         />
                         <Label htmlFor={`nav-${nav.id}`} className="flex items-center gap-2 font-normal">
                           <nav.icon className="h-4 w-4 text-muted-foreground"/> {nav.label}
                         </Label>
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
              </div>
          </div>
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
              <Button onClick={handleCreateLink} disabled={isLoading || (showBrandFilter && selectedBrandIds.length === 0)}>
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
