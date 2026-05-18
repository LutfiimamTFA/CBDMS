
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
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/firebase';
import type { Task } from '@/lib/types';
import { Link as LinkIcon, Copy, Loader2, KeyRound, Clock, Calendar as CalendarIcon, Eye, ListTodo, Edit } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface ShareTaskDialogProps {
  children: React.ReactNode;
  task: Task;
}

export function ShareTaskDialog({ children, task }: ShareTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { user: authUser } = useUserProfile(); 
  const { toast } = useToast();

  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  const handleCreateLink = async () => {
    if (!authUser) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to share tasks.' });
        return;
    }
    setIsLoading(true);
    setGeneratedLink(null);

    try {
      const idToken = await authUser.getIdToken();

      const response = await fetch('/api/share/task/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          password: usePassword ? password : undefined,
          expiresAt: expiresAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create share link.');
      }

      const { shareId } = await response.json();
      const newLink = `${window.location.origin}/share/task/${shareId}`;
      setGeneratedLink(newLink);
      toast({ title: 'Share link created successfully!' });

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
      setExpiresAt(undefined);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Task: {task.title}</DialogTitle>
          <DialogDescription>
            Create a secure, public link to share only this task with external collaborators.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
         <ScrollArea className="max-h-[60vh] -mx-6 px-6">
         <div className="space-y-6 py-4">
            <div className="space-y-4 rounded-md border p-4">
                <h4 className="text-sm font-medium">Viewer Permissions</h4>
                <p className="text-xs text-muted-foreground">
                    Based on your role, viewers will automatically be granted these permissions. This cannot be changed.
                </p>
                 <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> View task details</li>
                    <li className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-muted-foreground" /> Add comments and attachments</li>
                    <li className="flex items-center gap-2"><Edit className="h-4 w-4 text-muted-foreground" /> Change status (To Do, Doing, Preview)</li>
                </ul>
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
         </ScrollArea>
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
             <Button variant="outline" onClick={() => setIsOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
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
