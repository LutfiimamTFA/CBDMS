
'use client';

import React, { useState, useMemo } from 'react';
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
import { useFirestore, useUserProfile } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { SharedLink, Task } from '@/lib/types';
import { Share2, Link as LinkIcon, Copy, KeyRound, Loader2 } from 'lucide-react';

interface ShareTaskDialogProps {
  task: Task;
}

export function ShareTaskDialog({ task }: ShareTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Form state
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [allowComments, setAllowComments] = useState(false);

  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const handleCreateLink = async () => {
    if (!firestore || !profile) return;
    setIsLoading(true);
    setGeneratedLink(null);

    const linkData: Omit<SharedLink, 'id' | 'createdAt'> = {
      name: `Shared: ${task.title}`,
      linkType: 'task',
      targetId: task.id,
      companyId: profile.companyId,
      createdBy: profile.id,
      allowComments,
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
  
  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setGeneratedLink(null);
      setUsePassword(false);
      setPassword('');
      setAllowComments(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Task: "{task.title}"</DialogTitle>
          <DialogDescription>
            Create a public link to share this task. Anyone with the link will be able to view it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch id="allow-comments" checked={allowComments} onCheckedChange={setAllowComments} />
              <Label htmlFor="allow-comments">Allow public comments</Label>
            </div>
            <p className="text-xs text-muted-foreground">Visitors will be able to post comments as guests.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword} />
              <Label htmlFor="use-password">Protect with password</Label>
            </div>
            {usePassword && (
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {generatedLink && (
          <div className="space-y-2 pt-4">
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
