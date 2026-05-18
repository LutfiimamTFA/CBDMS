
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
import type { SharedLink, NavigationItem, Task, WorkflowStatus, Brand, User, SocialMediaPost, WebArticle } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar as CalendarIcon, Clock, type LucideIcon, Eye, Edit, ListTodo, ChevronDown } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return null;
  return <LucideIconComponent {...props} />;
};


// Define which nav items are shareable
const isShareable = (item: NavigationItem) => {
    const shareablePaths = ['/dashboard', '/tasks', '/tasks/schedule', '/social-media/board', '/social-media/posts', '/social-media/schedule', '/social-media/analytics', '/web/board', '/web/articles', '/web/schedule'];
    return shareablePaths.includes(item.path);
};


interface ShareViewDialogProps {
  children?: React.ReactNode;
}

const removeUndefined = (obj: any): any => {
    if (obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
    } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(typeof obj.toDate === 'function')) {
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

  const userTasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', profile.companyId));
    if (profile.role === 'Manager' && profile.brandIds?.length) q = query(q, where('brandId', 'in', profile.brandIds));
    else if (profile.role === 'Employee' || profile.role === 'PIC') q = query(q, where('assigneeIds', 'array-contains', profile.id));
    return q;
  }, [firestore, profile]);

  const socialPostsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', profile.companyId));
    if (profile.role === 'Manager' && profile.brandIds?.length) q = query(q, where('brandId', 'in', profile.brandIds));
    else if (profile.role === 'Employee' || profile.role === 'PIC') q = query(q, where('assigneeIds', 'array-contains', profile.id));
    return q;
  }, [firestore, profile]);

  const webArticlesQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'webArticles'), where('companyId', '==', profile.companyId));
    if (profile.role === 'Manager' && profile.brandIds?.length) q = query(q, where('brandId', 'in', profile.brandIds));
    else if (profile.role === 'Employee' || profile.role === 'PIC') q = query(q, where('assigneeIds', 'array-contains', profile.id));
    return q;
  }, [firestore, profile]);

  const { data: allVisibleTasks, isLoading: tasksLoading } = useCollection<Task>(userTasksQuery);
  const { data: allVisibleSocialPosts, isLoading: socialPostsLoading } = useCollection<SocialMediaPost>(socialPostsQuery);
  const { data: allVisibleWebArticles, isLoading: webArticlesLoading } = useCollection<WebArticle>(webArticlesQuery);

  const userNavItems = useMemo(() => {
    if (!profile) return [];
    return defaultNavItems.filter(item => item.roles.includes(profile.role));
  }, [profile]);
  
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
      const dashboardItem = shareableNavItems.find(item => item.id === 'nav_dashboard');
      setSelectedNavIds(dashboardItem ? [dashboardItem.id] : []);
    }
  }, [isOpen, shareableNavItems]);

  const isEmployeeRole = profile?.role === 'Employee' || profile?.role === 'PIC';

  const handleCreateLink = async () => {
    if (!firestore || !profile) return;

    setIsLoading(true);
    setGeneratedLink(null);

    try {
        const statusesQuery = query(collection(firestore, 'statuses'), orderBy('order'));
        const socialStatusesQuery = query(collection(firestore, 'socialMediaStatuses'), orderBy('order'));
        const webStatusesQuery = query(collection(firestore, 'webStatuses'), orderBy('order'));
        const usersQuery = query(collection(firestore, 'users'), where('companyId', '==', profile.companyId));
        const brandsQuery = query(collection(firestore, 'brands'), where('companyId', '==', profile.companyId));
        
        const [statusesSnap, socialStatusesSnap, webStatusesSnap, usersSnap, brandsSnap] = await Promise.all([
            getDocs(statusesQuery),
            getDocs(socialStatusesQuery),
            getDocs(webStatusesQuery),
            getDocs(usersQuery),
            getDocs(brandsQuery),
        ]);

        if (statusesSnap.empty) {
            throw new Error("Cannot create share link: A valid workflow was not found for this company.");
        }

        const snapshot = {
            tasks: allVisibleTasks || [],
            socialMediaPosts: allVisibleSocialPosts || [],
            webArticles: allVisibleWebArticles || [],
            statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            socialMediaStatuses: socialStatusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            webStatuses: webStatusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            users: usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
            brands: brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)),
        };
        
        // For a link sharing specific tasks, the only relevant nav item is the task list
        const allowedNavItems = navItems.filter(item => item.path === '/tasks');

        const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
          name: linkName || 'Shared Tasks',
          companyId: profile.companyId,
          creatorId: profile.id,
          creatorName: profile.name,
          creatorRole: profile.role,
          allowedNavItems: selectedNavIds, 
          navItems: userNavItems.map(item => ({...item, label: t(item.label as any) || item.label})),
          accessLevel: accessLevel,
          snapshot,
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
  
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setGeneratedLink(null);
      setUsePassword(false);
      setPassword('');
      setLinkName('');
      setExpiresAt(undefined);
      setAccessLevel('view');
    }
  }, [isOpen]);

  const anyLoading = tasksLoading || socialPostsLoading || webArticlesLoading;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Delegated Tasks</DialogTitle>
          <DialogDescription>
            Create a public link to share a snapshot of your current work view with external collaborators.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
         <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-name">Link Name (Optional)</Label>
                <Input id="link-name" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g., Q3 Client Preview" />
              </div>
              <Accordion type="single" collapsible defaultValue="pages" className="w-full space-y-4">
                 <AccordionItem value="pages" className="border rounded-lg">
                    <AccordionTrigger className="p-4 text-sm font-medium hover:no-underline">
                        Pages & Permissions
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 space-y-4">
                         <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">Available Pages</h4>
                            {shareableNavItems.map(item => (
                                <div key={item.id} className="flex items-center space-x-2">
                                    <Checkbox id={item.id} checked={selectedNavIds.includes(item.id)} onCheckedChange={(checked) => setSelectedNavIds(prev => checked ? [...prev, item.id] : prev.filter(id => id !== item.id))}/>
                                    <label htmlFor={item.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                                        <Icon name={item.icon} className="h-4 w-4 text-muted-foreground" />
                                        {t(item.label as any) || item.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground">Viewer Permissions</h4>
                          <RadioGroup value={accessLevel} onValueChange={(v: SharedLink['accessLevel']) => setAccessLevel(v)}>
                              <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                                <RadioGroupItem value="view" id="perm-view" />
                                <Label htmlFor="perm-view" className="flex flex-col gap-1 leading-normal cursor-pointer">
                                    <span className="font-semibold flex items-center gap-2"><Eye className='h-4 w-4' /> View Only</span>
                                    <span className="font-normal text-xs text-muted-foreground">Can view pages and task details. Cannot make any changes.</span>
                                </Label>
                              </div>
                              <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                                <RadioGroupItem value="status" id="perm-status" />
                                <Label htmlFor="perm-status" className="flex flex-col gap-1 leading-normal cursor-pointer">
                                    <span className="font-semibold flex items-center gap-2"><ListTodo className='h-4 w-4' /> Can Change Status</span>
                                    <span className="font-normal text-xs text-muted-foreground">Can view pages, change task statuses, and request revisions. {isEmployeeRole && "(Revisi & Done disabled)"}</span>
                                </Label>
                              </div>
                              <div className="flex items-start space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
                                <RadioGroupItem value="limited-edit" id="perm-edit" disabled={isEmployeeRole} />
                                <Label htmlFor="perm-edit" className={cn("flex flex-col gap-1 leading-normal", isEmployeeRole ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                                    <span className={cn("font-semibold flex items-center gap-2", !isEmployeeRole && "text-foreground")}><Edit className='h-4 w-4'/> Limited Edit</span>
                                    <span className="font-normal text-xs">Can change status, due date, and priority. (Only for Managers/Admins)</span>
                                </Label>
                              </div>
                            </RadioGroup>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="security" className="border rounded-lg">
                    <AccordionTrigger className="p-4 text-sm font-medium hover:no-underline">Access Control</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0 space-y-4">
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
                                    className={cn("w-[240px] justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}
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
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
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
              <Button onClick={handleCreateLink} disabled={isLoading || anyLoading || selectedNavIds.length === 0}>
                {isLoading || anyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Create Link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
