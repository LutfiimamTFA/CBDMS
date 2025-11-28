'use client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

export default function DataManagementPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const tasksCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'tasks') : null, [firestore]);
    const { data: tasks } = useCollection<Task>(tasksCollectionRef);
    
    const usersCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users } = useCollection<User>(usersCollectionRef);

    const [deleteConfirmation, setDeleteConfirmation] = useState({
      isOpen: false,
      type: '',
      onConfirm: () => {},
    });
    const [confirmationInput, setConfirmationInput] = useState('');

    const escapeCSVCell = (cellData: any) => {
        if (cellData === null || cellData === undefined) {
            return '';
        }
        
        const stringData = String(cellData);
        
        // If the data contains a comma, a double quote, or a newline,
        // it needs to be enclosed in double quotes.
        if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
            // Any double quote inside the data must be escaped by another double quote.
            const escapedData = stringData.replace(/"/g, '""');
            return `"${escapedData}"`;
        }
        
        return stringData;
    };

    const convertToCSV = (data: any[], headers: string[]) => {
        const headerRow = headers.map(escapeCSVCell).join(',');
        const rows = data.map(item => 
            headers.map(header => escapeCSVCell(item[header])).join(',')
        );
        return [headerRow, ...rows].join('\n');
    }

    const downloadCSV = (data: any[], filename: string, headers: string[]) => {
        if (!data || data.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Data',
                description: `There is no data to export for ${filename}.`,
            });
            return;
        }
        const csv = convertToCSV(data, headers);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
            title: 'Export Successful',
            description: `${filename} has been downloaded.`,
        });
    }

    const handleExportTasks = () => {
        const headers = ['id', 'title', 'status', 'priority', 'dueDate', 'timeEstimate', 'timeTracked'];
        downloadCSV(tasks || [], 'tasks-export.csv', headers);
    }
    
    const handleExportUsers = () => {
        const headers = ['id', 'name', 'email'];
        downloadCSV(users || [], 'users-export.csv', headers);
    }

    const openDeleteDialog = (type: 'tasks' | 'users') => {
      setDeleteConfirmation({
        isOpen: true,
        type,
        onConfirm: () => {
          console.log(`Confirmed deletion for ${type}`);
          toast({
            title: 'Action Triggered',
            description: `Process to delete all ${type} has started.`
          })
          setDeleteConfirmation({isOpen: false, type: '', onConfirm: () => {}});
          setConfirmationInput('');
        }
      });
    }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Data Management" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Data Export</CardTitle>
                    <CardDescription>
                        Backup your application data by exporting collections to CSV files.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex gap-4'>
                    <Button onClick={handleExportUsers}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Users
                    </Button>
                    <Button onClick={handleExportTasks}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Tasks
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle/>
                        Danger Zone
                    </CardTitle>
                    <CardDescription>
                        These are highly destructive actions that can result in permanent data loss. 
                        Proceed with extreme caution.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex gap-4'>
                    <Button variant="destructive" onClick={() => openDeleteDialog('tasks')}>
                        Delete All Tasks
                    </Button>
                    <Button variant="destructive" onClick={() => openDeleteDialog('users')}>
                        Delete All Users
                    </Button>
                </CardContent>
            </Card>
        </div>
      </main>

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(isOpen) => setDeleteConfirmation(prev => ({...prev, isOpen}))}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action is irreversible. You are about to delete all <strong>{deleteConfirmation.type}</strong> from the database. 
                      To confirm, please type <code className="font-mono bg-muted text-destructive-foreground p-1 rounded-sm">DELETE-{deleteConfirmation.type.toUpperCase()}</code> below.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <Input 
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type DELETE-${deleteConfirmation.type.toUpperCase()}`}
              />
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmationInput('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={deleteConfirmation.onConfirm} 
                    disabled={confirmationInput !== `DELETE-${deleteConfirmation.type.toUpperCase()}`}
                    className="bg-destructive hover:bg-destructive/90">
                    Confirm Deletion
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
