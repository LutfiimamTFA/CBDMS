
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
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2, Calendar as CalendarIcon, Clock, type LucideIcon, Eye, Edit, ListTodo, ChevronDown } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-provider';
import { defaultNavItems } from '@/lib/navigation-items';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return null;
  return <LucideIconComponent {...props} />;
};


// Define which nav items are shareable
const isShareable = (item: NavigationItem) => {
    const shareablePaths = ['/dashboard', '/tasks', '/calendar', '/schedule', '/social-media', '/social-media/analytics'];
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
  const [accessLevel, setAccessLevel] = useState<SharedLink['accessLevel']>('view');

  const userTasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    
    if (profile.role === 'Super Admin') {
        return query(collection(firestore, 'tasks'), where('companyId', '==', profile.companyId));
    }
    
    if (profile.role === 'Manager') {
        if (!profile.brandIds || profile.brandIds.length === 0) return null;
        return query(collection(firestore, 'tasks'), where('companyId', '==', profile.companyId), where('brandId', 'in', profile.brandIds));
    }
    
    return query(collection(firestore, 'tasks'), where('companyId', '==', profile.companyId), where('assigneeIds', 'array-contains', profile.id));

  }, [firestore, profile]);
  
  const { data: allVisibleTasks, isLoading: tasksLoading } = useCollection<Task>(userTasksQuery);
  
  const userNavItems = useMemo(() => {
    if (!profile) return [];
    return defaultNavItems.filter(item => item.roles.includes(profile.role));
  }, [profile]);
  
  const shareableNavItems = useMemo(() => userNavItems.filter(isShareable), [userNavItems]);
  
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const dashboardItem = shareableNavItems.find(item => item.id === 'nav_task_board');
      setSelectedNavIds(dashboardItem ? [dashboardItem.id] : []);
    }
  }, [isOpen, shareableNavItems]);

  const isEmployeeRole = profile?.role === 'Employee' || profile?.role === 'PIC';

  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    if (!allVisibleTasks || allVisibleTasks.length === 0) {
        toast({ variant: 'destructive', title: 'No Tasks to Share', description: 'There are no tasks in your current view to share.'});
        return;
    }

    setIsLoading(true);
    setGeneratedLink(null);

    try {
        const statusesQuery = query(collection(firestore, 'statuses'), orderBy('order'));
        const usersQuery = query(collection(firestore, 'users'), where('companyId', '==', profile.companyId));
        const brandsQuery = query(collection(firestore, 'brands'), where('companyId', '==', profile.companyId));
        
        const [statusesSnap, usersSnap, brandsSnap] = await Promise.all([
            getDocs(statusesQuery),
            getDocs(usersQuery),
            getDocs(brandsQuery),
        ]);

        if (statusesSnap.empty || statusesSnap.docs.length < 2) {
            throw new Error("Cannot create share link: A valid workflow (with at least 2 statuses) was not found for this company. Please configure it in the admin settings.");
        }

        const snapshot = {
            tasks: allVisibleTasks,
            statuses: statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus)),
            users: usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
            brands: brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)),
        };

        const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
          name: linkName || 'Shared View',
          companyId: profile.companyId,
          creatorId: profile.id,
          creatorName: profile.name,
          creatorRole: profile.role,
          allowedNavItems: selectedNavIds, 
          navItems: userNavItems.map(item => ({...item, label: t(item.label as any)})),
          accessLevel: accessLevel,
          snapshot,
          password: usePassword ? password : undefined,
          expiresAt: expiresAt || undefined,
          brandIds: profile.role === 'Manager' ? profile.brandIds : undefined,
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share View</DialogTitle>
          <DialogDescription>
            Create a public link to share all your currently visible tasks with external collaborators.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
         <ScrollArea className="max-h-[70vh] -mx-6 px-6">
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
              <Button onClick={handleCreateLink} disabled={isLoading || tasksLoading || selectedNavIds.length === 0}>
                {isLoading || tasksLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Create Link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
