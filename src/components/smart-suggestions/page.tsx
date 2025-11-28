
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Loader2, Wand2 } from 'lucide-react';
import { suggestTasks } from '@/ai/flows/smart-task-suggestions';
import type { SmartTaskSuggestionsOutput } from '@/ai/flows/smart-task-suggestions';
import { useCollection, useFirestore } from '@/firebase';
import type { Task } from '@/lib/types';
import { collection } from 'firebase/firestore';

export function SmartSuggestions() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] =
    useState<SmartTaskSuggestionsOutput['suggestedTasks'] | null>(null);
    
  const firestore = useFirestore();

  const tasksCollectionRef = useMemo(() => 
    firestore ? collection(firestore, 'tasks') : null, 
  [firestore]);

  const { data: tasks } = useCollection<Task>(tasksCollectionRef);


  const handleGetSuggestions = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const pastTasksString = (tasks || [])
        .map(
          (t) =>
            `- ${t.title}: (Status: ${t.status}, Priority: ${
              t.priority
            }, Time Tracked: ${t.timeTracked || 0}h)`
        )
        .join('\n');

      const result = await suggestTasks({
        pastTasks: pastTasksString,
        userRole: 'Employee', // Using a default role
      });

      setSuggestions(result.suggestedTasks);
    } catch (e) {
      console.error(e);
      setError('Failed to get suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = () => {
    setIsOpen(true);
    if (!suggestions) {
      handleGetSuggestions();
    }
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Wand2 className="h-4 w-4" />
        Suggestions
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="text-yellow-400" />
              Smart Task Suggestions
            </DialogTitle>
            <DialogDescription>
              Based on your recent work, here are a few tasks you might want to tackle next.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 min-h-[200px] flex items-center justify-center">
            {isLoading && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {suggestions && (
              <div className="space-y-3 w-full">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="p-3 bg-secondary/50 rounded-lg">
                    <h4 className="font-semibold font-headline">{suggestion.taskName}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>
                    <p className="text-xs font-medium text-primary mt-2">
                      Estimated Duration: {suggestion.estimatedDuration} hours
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button>
            <Button onClick={handleGetSuggestions} disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Regenerating...</> : 'Regenerate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
