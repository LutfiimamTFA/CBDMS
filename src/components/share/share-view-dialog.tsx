
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
import type { SharedLink, NavigationItem, Task, WorkflowStatus, Brand, User, SocialMediaPost } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar as CalendarIcon, Clock, type LucideIcon, Eye, Edit, ListTodo } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { priorityInfo } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const removeUndefined = (obj: any): any => {
    if (obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(typeof obj.toDate === 'function')) {
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

interface ShareViewDialogProps {
  children?: React.ReactNode;
  navItems: NavigationItem[];
}

export function ShareViewDialog({ children, navItems }: ShareViewDialogProps) {
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
  const [accessLevel, setAccessLevel] = useState<SharedLink['accessLevel']>('view');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  const isEmployeeOrPIC = useMemo(() => profile?.role === 'Employee' || profile?.role === 'PIC', [profile]);
  const isManagerOrAdmin = useMemo(() => profile?.role === 'Manager' || profile?.role === 'Super Admin', [profile]);
  
  const delegatedTasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'tasks'), 
      where('assigneeIds', 'array-contains', profile.id),
      where('companyId', '==', profile.companyId)
      // We will filter out tasks created by self on the client-side
    );
  }, [firestore, profile]);

  const { data: delegatedTasks, isLoading: tasksLoading } = useCollection<Task>(delegatedTasksQuery);

  const tasksToShow = useMemo(() => {
    if (!delegatedTasks || !profile) return [];
    // Only show tasks that are NOT created by the current user.
    return delegatedTasks.filter(task => task.createdBy.id !== profile.id);
  }, [delegatedTasks, profile]);


  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setGeneratedLink(null);
      setUsePassword(false);
      setPassword('');
      setLinkName('');
      setExpiresAt(undefined);
      setAccessLevel('view');
      setSelectedTaskIds([]);
    }
  }, [isOpen]);

  const handleCreateLink = async () => {
    if (!firestore || !profile || selectedTaskIds.length === 0) {
        toast({ variant: 'destructive', title: 'No Tasks Selected', description: 'Please select at least one task to share.' });
        return;
    }
    
    setIsLoading(true);
    setGeneratedLink(null);

    try {
        const selectedTasks = delegatedTasks?.filter(task => selectedTaskIds.includes(task.id)) || [];
        const statusesQuery = query(collection(firestore, 'statuses'), where('companyId', '==', profile.companyId), orderBy('order'));
        
        const [statusesSnap, usersSnap, brandsSnap, socialPostsSnap] = await Promise.all([
            getDocs(statusesQuery),
            getDocs(query(collection(firestore, 'users'), where('companyId', '==', profile.companyId))),
            getDocs(query(collection(firestore, 'brands'), where('companyId', '==', profile.companyId))),
            getDocs(query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', profile.companyId)))
        ]);

        if (statusesSnap.empty) {
            throw new Error("Cannot create share link: A valid workflow was not found for this company.");
        }

        const snapshot = {
            tasks: selectedTasks,
            statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            users: usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
            brands: brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)),
            socialMediaPosts: socialPostsSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as SocialMediaPost)),
        };
        
        // For a link sharing specific tasks, the only relevant nav item is the task list
        const allowedNavItems = navItems.filter(item => item.path === '/tasks');

        const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
          name: linkName || 'Shared Tasks',
          companyId: profile.companyId,
          creatorRole: profile.role,
          allowedNavItems: allowedNavItems.map(item => item.id), 
          navItems: navItems.map(item => ({...item, label: t(item.label as any)})),
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Delegated Tasks</DialogTitle>
          <DialogDescription>
            Create a public link to share specific tasks assigned to you by your manager.
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
                <h4 className="text-sm font-medium">Select Tasks to Share</h4>
                <p className="text-xs text-muted-foreground">Only tasks assigned to you by others are shown.</p>
                <ScrollArea className="h-48">
                    <div className="space-y-2 pr-4">
                        {tasksLoading && <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>}
                        {!tasksLoading && tasksToShow.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No delegated tasks found.</p>}
                        {tasksToShow.map(task => {
                            const PriorityIcon = priorityInfo[task.priority].icon;
                            return (
                                <div key={task.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent has-[:checked]:bg-accent">
                                    <Checkbox
                                        id={task.id}
                                        checked={selectedTaskIds.includes(task.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedTaskIds(prev => 
                                                checked ? [...prev, task.id] : prev.filter(id => id !== task.id)
                                            );
                                        }}
                                    />
                                    <label htmlFor={task.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer">
                                        <PriorityIcon className={cn("h-4 w-4", priorityInfo[task.priority].color)} />
                                        <span className="flex-1 truncate">{task.title}</span>
                                        <Badge variant="secondary">{task.status}</Badge>
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
              </div>

               <div className="space-y-4 rounded-md border p-4">
                  <h4 className="text-sm font-medium">Permissions for Viewer</h4>
                   <RadioGroup value={accessLevel} onValueChange={(v: SharedLink['accessLevel']) => setAccessLevel(v)}>
                      <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                        <RadioGroupItem value="view" id="perm-view" />
                        <Label htmlFor="perm-view" className="flex flex-col gap-1 leading-normal cursor-pointer">
                            <span className="font-semibold flex items-center gap-2"><Eye className='h-4 w-4' /> View Only</span>
                            <span className="font-normal text-xs text-muted-foreground">Can view shared pages and task details. Cannot make any changes.</span>
                        </Label>
                      </div>
                       <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                        <RadioGroupItem value="status" id="perm-status" />
                        <Label htmlFor="perm-status" className="flex flex-col gap-1 leading-normal cursor-pointer">
                            <span className="font-semibold flex items-center gap-2"><ListTodo className='h-4 w-4' /> Can Change Status</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Can view pages and change task statuses.
                                {isEmployeeOrPIC && <span className="font-bold text-destructive"> Cannot move tasks to "Done" or "Revisi".</span>}
                            </span>
                        </Label>
                      </div>
                       {isManagerOrAdmin && (
                        <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                          <RadioGroupItem value="limited-edit" id="perm-edit" />
                          <Label htmlFor="perm-edit" className="flex flex-col gap-1 leading-normal cursor-pointer">
                              <span className="font-semibold flex items-center gap-2"><Edit className='h-4 w-4'/> Limited Edit</span>
                              <span className="font-normal text-xs text-muted-foreground">Can change status, due date, and priority. Cannot edit content.</span>
                          </Label>
                        </div>
                       )}
                    </RadioGroup>
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
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTitle>Link Created Successfully!</AlertTitle>
              <AlertDescription>
                Anyone with this link can now view the tasks you selected with the permissions you've set.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="share-link">Your Shareable Link</Label>
              <div className="flex items-center gap-2">
                <Input id="share-link" value={generatedLink} readOnly />
                <Button size="icon" variant="secondary" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
             <Button variant="outline" onClick={() => setIsOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateLink} disabled={isLoading || selectedTaskIds.length === 0}>
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
