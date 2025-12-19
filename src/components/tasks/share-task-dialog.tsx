
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { SharedLink, NavigationItem, Task, WorkflowStatus, Brand, User, SocialMediaPost } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar as CalendarIcon, Clock, Eye, Edit, ListTodo } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { defaultNavItems } from '@/lib/navigation-items';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useI18n } from '@/context/i18n-provider';

// Function to recursively remove undefined values from any object
const removeUndefined = (obj: any): any => {
    if (obj === undefined) {
        return null; // Firestore cannot handle undefined
    }
    if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
    } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(typeof obj.toDate === 'function')) { // Exclude Timestamps
        return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) {
                (acc as any)[key] = removeUndefined(value);
            }
            return acc;
        }, {});
    }
    return obj;
};


interface ShareTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function ShareTaskDialog({ open, onOpenChange, task }: ShareTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const { t } = useI18n();
  
  const [linkName, setLinkName] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [accessLevel, setAccessLevel] = useState<SharedLink['accessLevel']>('view');
  
  const statusesQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: statuses } = useCollection<WorkflowStatus>(statusesQuery);
  const { data: brands } = useCollection<Brand>(useMemo(() => firestore ? query(collection(firestore, 'brands'), where('companyId', '==', profile?.companyId)) : null, [firestore, profile]));
  const { data: users } = useCollection<User>(useMemo(() => firestore ? query(collection(firestore, 'users'), where('companyId', '==', profile?.companyId)) : null, [firestore, profile]));

  const isCreatorEmployee = profile?.role === 'Employee' || profile?.role === 'PIC';
  const isCreatorManagerOrAdmin = profile?.role === 'Manager' || profile?.role === 'Super Admin';

  useEffect(() => {
    if (open) {
      setGeneratedLink(null);
      setLinkName(task.title);
      setUsePassword(false);
      setPassword('');
      setExpiresAt(undefined);
      setAccessLevel('view');
    }
  }, [open, task]);

  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    
    setIsLoading(true);
    setGeneratedLink(null);

    try {
        const snapshot = {
            tasks: [task], // Snapshot only contains the single task
            statuses: statuses || [],
            users: users || [],
            brands: brands || [],
            socialMediaPosts: [], // Not relevant for single task share
        };

        const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
          name: linkName || 'Shared Task',
          companyId: profile.companyId,
          creatorRole: profile.role,
          allowedNavItems: ['nav_list'], // A single task is just a task list view
          navItems: defaultNavItems.map(item => ({...item, label: t(item.label as any)})),
          accessLevel: accessLevel,
          snapshot,
          createdBy: profile.id,
          password: usePassword ? password : undefined,
          expiresAt: expiresAt || undefined,
        };
        
        const cleanedData = removeUndefined(linkData);

        const docRef = await addDoc(collection(firestore, 'sharedLinks'), {
            ...cleanedData,
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
  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Task: {task.title}</DialogTitle>
          <DialogDescription>
            Create a specific link for this task.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-name-task">Link Name</Label>
                <Input id="link-name-task" value={linkName} onChange={(e) => setLinkName(e.target.value)} />
              </div>
              
              <div className="space-y-4 rounded-md border p-4">
                  <h4 className="text-sm font-medium">Permissions for Viewer</h4>
                   <RadioGroup value={accessLevel} onValueChange={(v: SharedLink['accessLevel']) => setAccessLevel(v)}>
                      <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                        <RadioGroupItem value="view" id="perm-view-task" />
                        <Label htmlFor="perm-view-task" className="flex flex-col gap-1 leading-normal cursor-pointer">
                            <span className="font-semibold flex items-center gap-2"><Eye className='h-4 w-4' /> View Only</span>
                            <span className="font-normal text-xs text-muted-foreground">Can view the task. Cannot make any changes.</span>
                        </Label>
                      </div>
                       <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                        <RadioGroupItem value="status" id="perm-status-task" />
                        <Label htmlFor="perm-status-task" className="flex flex-col gap-1 leading-normal cursor-pointer">
                            <span className="font-semibold flex items-center gap-2"><ListTodo className='h-4 w-4' /> Can Change Status</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Can change task status.
                                {isCreatorEmployee && <span className="font-bold text-destructive"> Cannot move tasks to "Done" or "Revisi".</span>}
                            </span>
                        </Label>
                      </div>
                       {isCreatorManagerOrAdmin && (
                        <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                          <RadioGroupItem value="limited-edit" id="perm-edit-task" />
                          <Label htmlFor="perm-edit-task" className="flex flex-col gap-1 leading-normal cursor-pointer">
                              <span className="font-semibold flex items-center gap-2"><Edit className='h-4 w-4'/> Limited Edit</span>
                              <span className="font-normal text-xs text-muted-foreground">Can change status, due date, and priority.</span>
                          </Label>
                        </div>
                       )}
                    </RadioGroup>
              </div>

             <div className="space-y-4 rounded-md border p-4">
                <h4 className="text-sm font-medium">Access Control</h4>
                <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                        <Switch id="use-password-task" checked={usePassword} onCheckedChange={setUsePassword} />
                        <Label htmlFor="use-password-task">Protect with password</Label>
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
        ) : (
          <div className="space-y-2 py-4">
            <Label htmlFor="share-link-task">Your Shareable Link</Label>
            <div className="flex items-center gap-2">
              <Input id="share-link-task" value={generatedLink} readOnly />
              <Button size="icon" variant="secondary" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
             <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={isLoading}>
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
