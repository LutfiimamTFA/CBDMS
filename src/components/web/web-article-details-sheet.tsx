'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { WebArticle, User, Brand, WorkflowStatus, RevisionItem, RevisionCycle, Dependencies, Comment, Attachment, Subtask, Notification, Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { priorityInfo } from '@/lib/utils';
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Plus, XCircle, HelpCircle, History, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Workflow, Blocks, Send, GitMerge, ListTodo, MessageSquare, Trash, Trash2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { RichTextEditor } from '../ui/rich-text-editor';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { getFileIcon, getInitials } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';


const articleDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  content: z.string().optional(),
  status: z.string(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
});

type ArticleDetailsFormValues = z.infer<typeof articleDetailsSchema>;

interface WebArticleDetailsSheetProps {
  article: WebArticle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

const getCurrentSubmissionCycle = (article: WebArticle | null): number => {
    if (!article) return 1;
    const historyLength = article.revisionHistory?.length ?? 0;
    if (article.status === 'Revisi') {
        return historyLength + 1;
    }
    return historyLength > 0 ? historyLength : 1;
};

interface RevisionState {
  isOpen: boolean;
  item: WebArticle | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function WebArticleDetailsSheet({ 
  article: initialArticle, 
  open,
  onOpenChange,
}: WebArticleDetailsSheetProps) {
  const { toast } = useToast();
  
  const [articleState, setArticleState] = useState(initialArticle);
  useEffect(() => { setArticleState(initialArticle) }, [initialArticle]);
  
  const [newComment, setNewComment] = useState('');
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  
  const firestore = useFirestore();
  const { user: authUser, profile: currentUser } = useUserProfile();

  const allArticlesQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'webArticles'), where('companyId', '==', currentUser.companyId));
  }, [firestore, currentUser]);
  const { data: allArticles } = useCollection<WebArticle>(allArticlesQuery);
  
  const usersQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUser.companyId));
    return q;
  }, [firestore, currentUser]);
  const { data: allUsers } = useCollection<User>(usersQuery);
  
  const brandsQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'brands'), orderBy('name'));
  }, [firestore, currentUser]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const statusesQuery = useMemo(() => {
    if(!firestore) return null;
    return query(collection(firestore, 'webStatuses'), orderBy('order'))
  }, [firestore]);
  const { data: statuses } = useCollection<WorkflowStatus>(statusesQuery);
  
  const canEditContent = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'Super Admin' || currentUser.role === 'Manager' || currentUser.id === articleState.createdBy.id;
  }, [currentUser, articleState]);

  const canDelete = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'Super Admin' || currentUser.role === 'Manager' || currentUser.id === articleState.createdBy.id;
  }, [currentUser, articleState]);
  

  const handleDelete = () => {
    if (!firestore || !articleState || !canDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'webArticles', articleState.id));
    toast({ title: "Article Deleted", description: "The article is being removed." });
    onOpenChange(false);
    setDeleteConfirmOpen(false);
  };
  
  const handleConfirmRejection = async () => {
    if (!revisionState.item || revisionState.items.length === 0 || !firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    const item = revisionState.item;
    const itemRef = doc(firestore, 'webArticles', item.id);
    const newStatus = 'Revisi';
    
    const newRevisionItems: RevisionItem[] = revisionState.items.map(revItem => ({ id: crypto.randomUUID(), text: revItem.text, completed: false }));
    
    const newRevisionCycle: RevisionCycle = {
        cycleNumber: (item.revisionHistory?.length ?? 0) + 1,
        requestedAt: new Date().toISOString() as any,
        requestedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' },
        items: newRevisionItems,
    };
    
    const itemUpdateData: any = {
        statusInternal: newStatus,
        revisionItems: newRevisionItems,
        revisionHistory: [...(item.revisionHistory || []), newRevisionCycle],
        lastActivity: createActivity(currentUser, `requested revisions and moved item to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
    };
    itemUpdateData['activities'] = [...(item.activities || []), itemUpdateData.lastActivity];
    
    try {
        await updateDoc(itemRef, itemUpdateData);
        toast({ title: 'Revisions Requested', description: 'The item has been sent for revision.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send item for revision.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' });
    }
  };

  const handleAddRevisionItem = () => {
    if (revisionState.currentItemText.trim()) {
        setRevisionState(prev => ({
            ...prev,
            items: [...prev.items, { text: prev.currentItemText }],
            currentItemText: '',
        }));
    }
  };

  
  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
            <SheetHeader className="p-4 border-b flex-shrink-0">
                <SheetTitle className='sr-only'>Article Details for {articleState.title}</SheetTitle>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {articleState.createdBy && `Created by ${articleState.createdBy.name}`}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}><History className="mr-2 h-4 w-4"/>View History</DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete Article</DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SheetHeader>
            <div className="flex-1 flex min-h-0">
              <form id="edit-article-form" className='flex-1 flex min-h-0'>
                <div className="flex-1 grid md:grid-cols-3 min-h-0">
                    <ScrollArea className="md:col-span-2 h-full">
                        <div className="p-6 space-y-6">
                           <Input value={articleState.title} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/>
                           <RichTextEditor value={articleState.content || ''} onChange={() => {}} placeholder="Write your article content here..." readOnly={!canEditContent} />
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         {/* Details sidebar will go here */}
                    </ScrollArea>
                </div>
               </form>
            </div>
        </SheetContent>
    </Sheet>
    
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this article?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the article: <strong className="text-foreground">{articleState.title}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Article</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    
    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                  Revisions for item: <span className="font-bold text-foreground">{revisionState.item?.title}</span>
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    {revisionState.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                            <span className="flex-1 text-sm">{item.text}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevisionState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}))}><XCircle className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        value={revisionState.currentItemText}
                        onChange={(e) => setRevisionState(prev => ({...prev, currentItemText: e.target.value}))}
                        placeholder="e.g., Fix the typo in paragraph 2"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRevisionItem())}
                    />
                    <Button onClick={handleAddRevisionItem} disabled={!revisionState.currentItemText.trim()}>
                        <Plus className="mr-2 h-4 w-4"/> Add
                    </Button>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
