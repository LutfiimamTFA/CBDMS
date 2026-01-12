'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { tags as allTags } from '@/lib/data';
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Copy, Loader2, Mail, Plus, Repeat, Share, Tag, Trash, Trash2, User, UserPlus, Users, Wand2, X, Hash, Calendar as CalendarIcon, Type, List, Paperclip, FileUp, Link as LinkIcon, FileImage, HelpCircle, Star, Timer, Blocks, GitMerge, ListTodo, MessageSquare, AtSign, Send, Edit, FileText, Building2, Bold, Italic, List as ListIcon, ListOrdered, Table as TableIcon, Upload, Workflow } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Tag as TagType, TimeLog, Task, User as UserType, Subtask, Comment, Attachment, Notification, WorkflowStatus, Brand, SocialMediaPost } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';
import { MultiSelect } from '../ui/multi-select';
import { addDays, format, formatDistanceToNow, parse, parseISO, startOfWeek, nextSaturday } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getInitials } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RichTextEditor } from '../ui/rich-text-editor';
import { formatHours } from '@/lib/utils';


const postSchema = z.object({
  caption: z.string().min(1, 'Caption is required'),
  brandId: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  postType: z.enum(['Upload', 'Branding']),
  platform: z.string().min(1, 'Platform is required'),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  startDate: z.string().optional(),
  scheduledAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
});


type PostFormValues = z.infer<typeof postSchema>;

type ShareSetting = 'public' | 'private';

type CustomFieldType = 'Text' | 'Number' | 'Date' | 'Dropdown';
type CustomField = {
  id: number;
  name: string;
  type: CustomFieldType;
  value: string;
  options?: string; // For dropdown options
};


export function CreatePostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<UserType[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<TagType[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();

  const [timeLogs, setTimeLogs] = React.useState<TimeLog[]>([]);
  const [timeTracked, setTimeTracked] = React.useState(0);
  const [logNote, setLogNote] = React.useState('');
  const [logDate, setLogDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = React.useState(format(new Date(), 'HH:mm'));
  const [endTime, setEndTime] = React.useState(format(new Date(), 'HH:mm'));
  
  const [customFields, setCustomFields] = React.useState<CustomField[]>([]);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [deliverables, setDeliverables] = React.useState<Attachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);

  const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(3);


  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');


  const [subtasks, setSubtasks] = React.useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = React.useState<UserType | null>(null);
  const [waitingOnTaskIds, setWaitingOnTaskIds] = React.useState<string[]>([]);
  const [blockingTaskIds, setBlockingTaskIds] = React.useState<string[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [mentionSuggestions, setMentionSuggestions] = React.useState<UserType[]>([]);
  const [isMentioning, setIsMentioning] = React.useState(false);
  
  const firestore = useFirestore();
  const storage = useStorage();

  const { user, profile: currentUserProfile } = useUserProfile();

  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
    
    if (currentUserProfile.role === 'Employee' && currentUserProfile.managerId) {
      // This is a simplification. A more robust query might use an 'in' clause 
      // if we fetch manager's direct reports IDs first. For now, fetching all and filtering client-side is acceptable.
    }
    
    return q;
  }, [firestore, currentUserProfile]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);
  
  const userOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return [];

    if (currentUserProfile.role === 'Super Admin') {
        return allUsers
            .filter(u => u.role === 'Manager' || u.role === 'Employee')
            .map(user => ({ value: user.id, label: user.name }));
    }

    if (currentUserProfile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === currentUserProfile.id);
      const self = allUsers.find(u => u.id === currentUserProfile.id);
      const options = self ? [self, ...team] : team;
      return options.map(user => ({ value: user.id, label: user.name }));
    }
    
    if (currentUserProfile.role === 'Employee') {
        const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
        return myTeam.map(user => ({ value: user.id, label: user.name }));
    }

    return [];

  }, [allUsers, currentUserProfile]);

  
  const tasksCollectionRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'tasks');
  }, [firestore]);

  const { data: allTasks } = useCollection<Task>(tasksCollectionRef);
  
  const brandsQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    
    if (currentUserProfile.role === 'Manager') {
        if (!currentUserProfile.brandIds || currentUserProfile.brandIds.length === 0) {
            return query(collection(firestore, 'brands'), where('__name__', '==', 'no-brands-for-manager'));
        }
        return query(collection(firestore, 'brands'), where('__name__', 'in', currentUserProfile.brandIds), orderBy('name'));
    }
    
    return query(collection(firestore, 'brands'), orderBy('name'));

  }, [firestore, currentUserProfile]);

  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const dependencyOptions = useMemo(() => {
    if (!allTasks || !currentUserProfile) return [];

    // Super Admin sees all tasks
    if (currentUserProfile.role === 'Super Admin') {
      return allTasks;
    }

    // Manager sees tasks only from their managed brands
    if (currentUserProfile.role === 'Manager') {
      return allTasks.filter(task => (currentUserProfile.brandIds || []).includes(task.brandId));
    }

    // Employee/PIC sees tasks from brands they are involved in
    const userBrandIds = new Set(
        allTasks
            .filter(t => t.assigneeIds.includes(currentUserProfile.id))
            .map(t => t.brandId)
    );
    return allTasks.filter(task => userBrandIds.has(task.brandId));

  }, [allTasks, currentUserProfile]);


  const groupedDependencyOptions = useMemo(() => {
      const grouped: Record<string, Task[]> = {};
      dependencyOptions.forEach(task => {
          const brandName = brands?.find(b => b.id === task.brandId)?.name || 'Unbranded';
          if (!grouped[brandName]) {
              grouped[brandName] = [];
          }
          grouped[brandName].push(task);
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [dependencyOptions, brands]);


  const groupedUsers = useMemo(() => {
    if (!allUsers || !currentUserProfile) return { managers: [], employees: [], clients: [] };
    
    if (currentUserProfile.role === 'Super Admin') {
      const managers = (allUsers || []).filter(u => u.role === 'Manager');
      const employees = (allUsers || []).filter(u => u.role === 'Employee');
      const clients = (allUsers || []).filter(u => u.role === 'Client');
      return { managers, employees, clients };
    }
    
    if (currentUserProfile.role === 'Manager') {
        const self = (allUsers || []).find(u => u.id === currentUserProfile.id);
        const myEmployees = (allUsers || []).filter(u => u.managerId === currentUserProfile.id && u.id !== currentUserProfile.id);
        return { managers: self ? [self] : [], employees: myEmployees, clients: [] };
    }
    
    if (currentUserProfile.role === 'Employee') {
      const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
      return { managers: [], employees: myTeam, clients: [] };
    }

    return { managers: [], employees: [], clients: [] };
  }, [allUsers, currentUserProfile]);

  const subtaskAssigneeOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return {};

    const createGroup = (title: string, users: UserType[]) => users.length > 0 ? { [title]: users } : {};

    const mainAssignees = selectedUsers;

    if (currentUserProfile.role === 'Super Admin') {
        const managers = allUsers.filter(u => u.role === 'Manager' && !mainAssignees.some(a => a.id === u.id));
        const employees = allUsers.filter(u => u.role === 'Employee' && !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("Managers", managers),
            ...createGroup("Employees", employees),
        };
    }
    
    if (currentUserProfile.role === 'Manager') {
        const selfAndTeam = (allUsers || []).filter(u => u.id === currentUserProfile.id || u.managerId === currentUserProfile.id);
        const otherMembers = selfAndTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherMembers),
        };
    }
    
    if (currentUserProfile.role === 'Employee') {
        const manager = allUsers.find(u => u.id === currentUserProfile.managerId);
        const myTeam = allUsers.filter(u => u.managerId === currentUserProfile.managerId);
        
        const teamWithManager = [...myTeam];
        if (manager && !teamWithManager.some(u => u.id === manager.id)) {
            teamWithManager.push(manager);
        }

        const otherTeamMembers = teamWithManager.filter(u => !mainAssignees.some(a => a.id === u.id));

        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherTeamMembers),
        };
    }

    return {};
  }, [selectedUsers, allUsers, currentUserProfile]);


  const quickDateOptions = [
      { label: t('addtask.form.quickselect.today'), getValue: () => new Date() },
      { label: t('addtask.form.quickselect.tomorrow'), getValue: () => addDays(new Date(), 1) },
      { label: t('addtask.form.quickselect.thisweekend'), getValue: () => nextSaturday(new Date()) },
      { label: t('addtask.form.quickselect.nextweek'), getValue: () => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7) },
      { label: t('addtask.form.quickselect.nextweekend'), getValue: () => addDays(nextSaturday(new Date()), 7) },
      { label: t('addtask.form.quickselect.2weeks'), getValue: () => addDays(new Date(), 14) },
      { label: t('addtask.form.quickselect.4weeks'), getValue: () => addDays(new Date(), 28) },
  ];

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      caption: '',
      brandId: '',
      description: '',
      platform: 'Instagram',
      postType: 'Upload',
      assigneeIds: [],
      startDate: '',
      scheduledAt: undefined,
      timeEstimate: undefined,
      tags: [],
    },
  });
  
  const singleBrandId = useMemo(() => {
    if (brands && brands.length === 1) {
        return brands[0].id;
    }
    return null;
  }, [brands]);

  useEffect(() => {
    if (open) {
        // Reset all local states when dialog opens
        form.reset({
          caption: '',
          brandId: singleBrandId || '',
          description: '',
          platform: 'Instagram',
          postType: 'Upload',
          assigneeIds: [],
          startDate: '',
          scheduledAt: undefined,
          timeEstimate: undefined,
          tags: [],
        });

        setSelectedUsers([]);
        setSelectedTags([]);
        setTimeLogs([]);
        setTimeTracked(0);
        setLogNote('');
        setCustomFields([]);
        setAttachments([]);
        setDeliverables([]);
        setSubtasks([]);
        setWaitingOnTaskIds([]);
        setBlockingTaskIds([]);
        setLinkedTaskIds([]);
        setComments([]);
        setSuggestionReason(null);
        
        if (currentUserProfile && user) {
             if (currentUserProfile.role === 'Employee') {
                const selfUser = allUsers?.find(u => u.id === user.uid);
                if (selfUser) {
                    setSelectedUsers([selfUser]);
                    form.setValue('assigneeIds', [selfUser.id]);
                }
            }
        }
        if (singleBrandId) {
            form.setValue('brandId', singleBrandId);
        }

    }
  }, [open, currentUserProfile, user, form, allUsers, singleBrandId]);


  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);

    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));
    const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        if (key === 'scheduledAt' && value instanceof Date) {
          (acc as any)[key] = value.toISOString();
        } else {
          (acc as any)[key] = value;
        }
      }
      return acc;
    }, {} as Partial<PostFormValues>);

    const newPostData = {
        ...cleanedData,
        // Defaulting to draft, you might want a "submit for review" button
        status: 'Draft', 
        createdAt: new Date().toISOString(),
        assignees: selectedUsers,
        tags: selectedTags,
        timeLogs,
        timeTracked,
        subtasks,
        waitingOnTaskIds,
        blockingTaskIds,
        linkedTaskIds,
        comments,
        attachments,
        deliverables,
        companyId: currentUserProfile.companyId,
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
    };
    batch.set(newPostRef, newPostData);

    selectedUsers.forEach(assignee => {
        if (assignee.id === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assignee.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assignee.id,
            title: 'New Social Media Post Assigned',
            message: `${currentUserProfile.name} assigned you a new post: "${data.caption}"`,
            taskId: newPostRef.id, // Using taskId to link back
            isRead: false,
            createdAt: serverTimestamp(),
            createdBy: {
                id: currentUserProfile.id,
                name: currentUserProfile.name,
                avatarUrl: currentUserProfile.avatarUrl || '',
            }
        };
        batch.set(notificationRef, notification);
    });
    
    comments.forEach(comment => {
        const mentionedUsernames = comment.text.match(/@(\w+)/g)?.map(m => m.substring(1));
        if (mentionedUsernames) {
            const mentionedUsers = (allUsers || []).filter(u => mentionedUsernames.includes(u.name.split(' ')[0]));
            mentionedUsers.forEach(mentionedUser => {
                if (mentionedUser.id === currentUserProfile.id) return;
                
                const notifRef = doc(collection(firestore, `users/${mentionedUser.id}/notifications`));
                const notification: Omit<Notification, 'id'> = {
                    userId: mentionedUser.id,
                    title: 'You were mentioned',
                    message: `${comment.user.name} mentioned you in a comment on task: "${data.caption}"`,
                    taskId: newPostRef.id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    createdBy: {
                        id: comment.user.id,
                        name: comment.user.name,
                        avatarUrl: comment.user.avatarUrl,
                    }
                };
                batch.set(notifRef, notification);
            });
        }
    });

    try {
        await batch.commit();
        toast({
            title: 'Social Media Post Created',
            description: `${data.caption} has been added as a draft.`
        });
        setOpen(false);

    } catch (error) {
        console.error("Failed to create post:", error);
        toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: 'Could not create the post. Please try again.'
        });
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'attachment' | 'deliverable') => {
    if (!event.target.files || !storage) return;
    
    setIsUploading(true);
    const files = Array.from(event.target.files);
    
    try {
        const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `attachments/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return {
                id: `local-${Date.now()}-${file.name}`,
                name: file.name,
                type: 'local' as const,
                url: url,
            };
        });
        
        const newFiles = await Promise.all(uploadPromises);
        if (fileType === 'attachment') {
            setAttachments(prev => [...prev, ...newFiles]);
        } else {
            setDeliverables(prev => [...prev, ...newFiles]);
        }
        
        toast({ title: 'Upload Successful', description: `${files.length} file(s) have been attached.` });

    } catch (error) {
        console.error("File upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload files. Please try again.' });
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmGdriveLink = () => {
    if (gdriveLink && gdriveName) {
      const newFile: Attachment = {
        id: `gdrive-${Date.now()}`,
        name: gdriveName,
        type: 'gdrive',
        url: gdriveLink,
      };
       if (gdriveFileType === 'attachment') {
        setAttachments(prev => [...prev, newFile]);
      } else {
        setDeliverables(prev => [...prev, newFile]);
      }
      setIsGdriveDialogOpen(false);
      setGdriveLink('');
      setGdriveName('');
    } else {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide both a link and a name.' });
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };
  
  const handleRemoveDeliverable = (id: string) => {
    setDeliverables(prev => prev.filter(att => att.id !== id));
  };
  
  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      const newSubtask: Subtask = {
        id: `sub-${Date.now()}`,
        title: newSubtaskTitle,
        completed: false,
        ...(newSubtaskAssignee && { assignee: { id: newSubtaskAssignee.id, name: newSubtaskAssignee.name, avatarUrl: newSubtaskAssignee.avatarUrl || '' } }),
      };
      setSubtasks([...subtasks, newSubtask]);
      setNewSubtaskTitle('');
      setNewSubtaskAssignee(null);
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(
      subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
    );
  };
  
  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  }
  
  const handleAssignSubtask = (subtaskId: string, user: UserType | null) => {
    const newSubtasks = subtasks.map(st => {
      if (st.id === subtaskId) {
        return { 
          ...st, 
          assignee: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' } : undefined 
        };
      }
      return st;
    });
    setSubtasks(newSubtasks);
  };

  const handlePostComment = () => {
    if (!newComment.trim() || !currentUserProfile || !user) return;
    const comment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user: {
        id: user.uid,
        name: currentUserProfile.name || 'Unknown User',
        email: currentUserProfile.email || '',
        avatarUrl: currentUserProfile.avatarUrl || '',
        role: currentUserProfile.role,
        companyId: currentUserProfile.companyId,
        createdAt: currentUserProfile.createdAt,
      },
      text: newComment,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setComments([...comments, comment]);
    setNewComment('');
    setIsMentioning(false);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);

    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      setIsMentioning(true);
      setMentionSuggestions((allUsers || []).filter(u => u.name.toLowerCase().includes(mentionMatch[1].toLowerCase())));
    } else {
      setIsMentioning(false);
    }
  };

  const handleMentionSelect = (user: UserType) => {
    const currentComment = newComment;
    const atIndex = currentComment.lastIndexOf('@');
    const newCommentText = `${currentComment.substring(0, atIndex)}@${user.name.split(' ')[0]} `;
    setNewComment(newCommentText);
    setIsMentioning(false);
  };

  const handleAddDependency = (taskId: string, type: 'waitingOn' | 'blocking' | 'linked') => {
    if (type === 'waitingOn' && !waitingOnTaskIds.includes(taskId)) setWaitingOnTaskIds(prev => [...prev, taskId]);
    if (type === 'blocking' && !blockingTaskIds.includes(taskId)) setBlockingTaskIds(prev => [...prev, taskId]);
    if (type === 'linked' && !linkedTaskIds.includes(taskId)) setLinkedTaskIds(prev => [...prev, taskId]);
  };
  
  const handleRemoveDependency = (taskId: string, type: 'waitingOn' | 'blocking' | 'linked') => {
    if (type === 'waitingOn') setWaitingOnTaskIds(prev => prev.filter(id => id !== taskId));
    if (type === 'blocking') setBlockingTaskIds(prev => prev.filter(id => id !== taskId));
    if (type === 'linked') setLinkedTaskIds(prev => prev.filter(id => id !== taskId));
  };


  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);

  const renderDependencyList = (ids: string[], type: 'waitingOn' | 'blocking' | 'linked') => (
      <div className="flex flex-wrap gap-2">
          {ids.map(id => {
              const task = allTasks?.find(t => t.id === id);
              return task ? (
                  <Badge key={id} variant="secondary">
                      {task.title}
                      <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5">
                          <X className="h-3 w-3" />
                      </button>
                  </Badge>
              ) : null;
          })}
      </div>
  );
  

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Social Media Post</SheetTitle>
          <SheetDescription>
            Fill in the details for the new social media post.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form
                  id="create-post-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6 lg:col-span-2">
                       <FormField
                        control={form.control}
                        name="caption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caption</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Announcing our new summer collection!" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Internal Notes/Description</FormLabel>
                            <FormControl>
                              <RichTextEditor
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Add internal notes, links, or further details..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6 lg:col-span-1">
                      <FormField
                          control={form.control}
                          name="postType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Post Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a post type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Upload">Upload</SelectItem>
                                  <SelectItem value="Branding">Branding</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      <FormField
                        control={form.control}
                        name="brandId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a brand" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {areBrandsLoading ? (
                                  <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : (
                                  brands?.map((brand) => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                      <div className="flex items-center gap-2">
                                          <Building2 className="h-4 w-4" />
                                          {brand.name}
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="assigneeIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            {areUsersLoading ? (
                              <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                              <MultiSelect
                                options={userOptions}
                                onValueChange={(value) => {
                                  form.setValue('assigneeIds', value);
                                  setSelectedUsers(
                                    allUsers?.filter((u) => value.includes(u.id)) || []
                                  );
                                }}
                                defaultValue={field.value || []}
                                placeholder="Select team members..."
                              />
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <div className="space-y-4 rounded-lg border p-4">
                          <h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" />Dates</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)}/>
                              <FormField
                                  control={form.control}
                                  name="scheduledAt"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                      <FormLabel>Schedule Date</FormLabel>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <FormControl>
                                            <Button
                                              variant={"outline"}
                                              className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                              )}
                                            >
                                              {field.value ? (
                                                format(field.value, "PPP")
                                              ) : (
                                                <span>Pick a date</span>
                                              )}
                                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                          </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <CalendarComponent
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => date < new Date("1900-01-01")}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                          </div>
                      </div>

                       <div className='space-y-4 p-4 rounded-lg border'>
                          <div className="flex justify-between items-center"><h3 className='font-semibold text-sm'>Time Management</h3><div></div></div>
                          <Separator/>
                            <FormField
                                control={form.control}
                                name="timeEstimate"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-3 items-center gap-2">
                                        <FormLabel className="text-muted-foreground text-sm">Est. Pengerjaan (hari)</FormLabel>
                                        <div className="col-span-2 flex items-center gap-2">
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={field.value !== undefined ? field.value / 8 : ''} 
                                                onChange={(e) => {
                                                    const days = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                    const hours = days !== undefined ? days * 8 : undefined;
                                                    field.onChange(hours);
                                                }}
                                                placeholder="e.g., 1.5"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">({field.value || 0} jam)</span>
                                        </div>
                                    </FormItem>
                                )}
                            />
                      </div>
                    </div>
                  </div>
                  <Tabs defaultValue="subtasks" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                      <TabsTrigger value="materials"><Paperclip className="mr-2"/>Materials</TabsTrigger>
                      <TabsTrigger value="deliverables"><Upload className="mr-2"/>Deliverables</TabsTrigger>
                      <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                      <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                      <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span></div><Progress value={subtaskProgress} /></div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {subtasks.map((subtask) => (
                              <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors">
                                  <Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} />
                                  <label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                  
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                        {subtask.assignee ? <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{subtask.assignee.name.charAt(0)}</AvatarFallback></Avatar> : <UserPlus className="h-4 w-4" />}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-60 p-1">
                                        <ScrollArea className="max-h-60">
                                            <div className="space-y-1">
                                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleAssignSubtask(subtask.id, null)}>Unassigned</Button>
                                                {Object.entries(subtaskAssigneeOptions).map(([group, users]) => (
                                                  users.length > 0 && (
                                                    <React.Fragment key={group}>
                                                        <Separator />
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                                                        {users.map(user => (
                                                          <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleAssignSubtask(subtask.id, user)}>
                                                            <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                                            <span className="truncate">{user.name}</span>
                                                          </Button>
                                                        ))}
                                                    </React.Fragment>
                                                  )
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </PopoverContent>
                                  </Popover>
                                  
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button>
                              </div>
                          ))}
                      </div>
                      <div className="flex items-center gap-2">
                          <Input placeholder="Add a new subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground">
                                {newSubtaskAssignee ? (
                                  <Avatar className="h-6 w-6"><AvatarImage src={newSubtaskAssignee.avatarUrl} /><AvatarFallback>{newSubtaskAssignee.name.charAt(0)}</AvatarFallback></Avatar>
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-1">
                              <ScrollArea className="max-h-60">
                                  <div className="space-y-1">
                                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setNewSubtaskAssignee(null)}>Unassigned</Button>
                                       {Object.entries(subtaskAssigneeOptions).map(([group, users]) => (
                                          users.length > 0 && (
                                              <React.Fragment key={group}>
                                                  <Separator />
                                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                                                  {users.map(user => (
                                                      <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}>
                                                          <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                                          <span className="truncate">{user.name}</span>
                                                      </Button>
                                                  ))}
                                              </React.Fragment>
                                          )
                                      ))}
                                  </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          <Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="materials" className="mt-4 space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                          {attachments.map((att) => (
                              <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                  {getFileIcon(att.name)}
                                  <span className="truncate" title={att.name}>{att.name}</span>
                                  </a>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveAttachment(att.id)}>
                                      <X className="h-4 w-4" />
                                  </Button>
                              </div>
                          ))}
                          {attachments.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No supporting materials attached.</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                          <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" />
                          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button>
                          <Button type="button" variant="outline" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}><div className="flex items-center justify-center gap-2"><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</div></Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="deliverables" className="mt-4 space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                          <h4 className="font-medium text-sm">Initial Submission</h4>
                          {deliverables.length > 0 ? deliverables.map((att) => (
                              <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                      {getFileIcon(att.name)}
                                      <span className="truncate" title={att.name}>{att.name}</span>
                                  </a>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveDeliverable(att.id)}>
                                      <X className="h-4 w-4" />
                                  </Button>
                              </div>
                          )) : (
                            <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted yet.</p>
                          )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                          <input type="file" ref={commentFileInputRef} onChange={(e) => handleFileChange(e, 'deliverable')} multiple className="hidden" />
                          <Button type="button" variant="outline" onClick={() => commentFileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button>
                          <Button type="button" variant="outline" onClick={() => { setGdriveFileType('deliverable'); setIsGdriveDialogOpen(true); }}><div className="flex items-center justify-center gap-2"><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</div></Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                      <div className="space-y-3">
                          <h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4>
                          <p className="text-xs text-muted-foreground">Tugas-tugas ini harus selesai sebelum tugas ini bisa dimulai.</p>
                          {renderDependencyList(waitingOnTaskIds, 'waitingOn')}
                           <Popover>
                              <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                              <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'waitingOn')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                          </Popover>
                      </div>
                      <Separator/>
                      <div className="space-y-3">
                          <h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4>
                          <p className="text-xs text-muted-foreground">Tugas ini menghalangi penyelesaian tugas-tugas berikut.</p>
                          {renderDependencyList(blockingTaskIds, 'blocking')}
                          <Popover>
                              <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                              <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'blocking')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                          </Popover>
                      </div>
                      <Separator/>
                      <div className="space-y-3">
                          <h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Tasks</h4>
                          <p className="text-xs text-muted-foreground">Tugas-tugas yang berhubungan tapi tidak saling memblokir.</p>
                          {renderDependencyList(linkedTaskIds, 'linked')}
                          <Popover>
                              <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                              <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'linked')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                          </Popover>
                      </div>
                    </TabsContent>
                    <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                          {comments.map((comment) => (
                            <div key={comment.id} className="flex items-start gap-3">
                                <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar>
                                <div>
                                  <p className="font-semibold text-sm">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p>
                                  <p className="text-sm">{comment.text}</p>
                                </div>
                            </div>
                          ))}
                          {comments.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                        </div>
                        <div className="flex items-start gap-2 pt-4 border-t">
                            <Avatar className="h-9 w-9"><AvatarImage src={currentUserProfile?.avatarUrl} /><AvatarFallback>{getInitials(currentUserProfile?.name)}</AvatarFallback></Avatar>
                            <div className="flex-1 relative">
                              <Textarea placeholder="Write a comment... (use '@' to mention)" value={newComment} onChange={handleCommentChange} />
                              {isMentioning && (
                                  <Card className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto">
                                  <CardContent className="p-1">
                                      {mentionSuggestions.map(user => (
                                      <Button key={user.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => handleMentionSelect(user)}>
                                          <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                          {user.name}
                                      </Button>
                                      ))}
                                  </CardContent>
                                  </Card>
                              )}
                            </div>
                            <Button type="button" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                        </div>
                    </TabsContent>
                  </Tabs>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="create-post-form">
            Create Post
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
     <Dialog open={isGdriveDialogOpen} onOpenChange={setIsGdriveDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Link Google Drive File</DialogTitle>
                <DialogDescription>
                    Paste the shareable link to your Google Drive file below.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label htmlFor="gdrive-name">File Name</Label>
                    <Input id="gdrive-name" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="gdrive-link">File Link</Label>
                    <Input id="gdrive-link" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmGdriveLink}>Add Link</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
