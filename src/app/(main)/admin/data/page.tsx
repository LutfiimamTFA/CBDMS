
'use client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, Database, Trash2, Upload, Send } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, writeBatch, getDocs, query, orderBy } from 'firebase/firestore';
import type { Task, User, Brand, WorkflowStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useState } from 'react';
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
    
    const tasksCollectionRef = useMemo(() => firestore ? collection(firestore, 'tasks') : null, [firestore]);
    const { data: tasks } = useCollection<Task>(tasksCollectionRef);
    
    const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users } = useCollection<User>(usersCollectionRef);
    
    const brandsCollectionRef = useMemo(() => firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null, [firestore]);
    const { data: brands } = useCollection<Brand>(brandsCollectionRef);
    
    const statusesCollectionRef = useMemo(() => firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null, [firestore]);
    const { data: statuses } = useCollection<WorkflowStatus>(statusesCollectionRef);

    const [deleteConfirmation, setDeleteConfirmation] = useState({
      isOpen: false,
      type: '',
      onConfirm: () => {},
    });
    const [confirmationInput, setConfirmationInput] = useState('');
    const [isJobRunning, setIsJobRunning] = useState(false);

    const escapeCSVCell = (cellData: any) => {
        if (cellData === null || cellData === undefined) {
            return '';
        }
        
        let stringData = String(cellData);
        
        if (typeof cellData === 'object' && cellData !== null) {
            stringData = JSON.stringify(cellData);
        }
        
        if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
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
        if (!tasks) return;
        const headers = ['id', 'title', 'brandId', 'status', 'priority', 'dueDate', 'timeEstimate', 'timeTracked', 'assigneeIds', 'companyId', 'createdAt'];
        downloadCSV(tasks, 'tasks-export.csv', headers);
    }
    
    const handleExportUsers = () => {
        if (!users) return;
        const headers = ['id', 'name', 'email', 'role', 'companyId', 'createdAt'];
        downloadCSV(users, 'users-export.csv', headers);
    }
    
    const handleExportBrands = () => {
        if (!brands) return;
        const headers = ['id', 'name', 'createdAt'];
        downloadCSV(brands, 'brands-export.csv', headers);
    }

    const handleExportWorkflow = () => {
        if (!statuses) return;
        const headers = ['id', 'name', 'order', 'color', 'companyId'];
        downloadCSV(statuses, 'workflow-export.csv', headers);
    }

    const handleExportAllData = () => {
        if (!users && !tasks && !brands && !statuses) {
             toast({
                variant: 'destructive',
                title: 'No Data Available',
                description: `There is no application data to export.`,
            });
            return;
        }

        const allData = {
            users: users || [],
            tasks: tasks || [],
            brands: brands || [],
            statuses: statuses || [],
        };
        
        const jsonString = JSON.stringify(allData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'workwise-backup.json');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
            title: 'Full Export Successful',
            description: `workwise-backup.json has been downloaded.`,
        });
    };

    const runSchedulerJob = async () => {
        setIsJobRunning(true);
        try {
            const response = await fetch('/api/run-scheduler');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to run the job.');
            }
            toast({
                title: 'Scheduler Job Executed',
                description: data.message,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Job Execution Failed',
                description: error.message,
            });
        } finally {
            setIsJobRunning(false);
        }
    }

    const openDeleteDialog = () => {
      if (!firestore) return;
      
      const confirmAction = async () => {
          // Collections for "Smart Reset". Users and Permissions are intentionally excluded.
          const collectionsToDelete = ['tasks', 'brands', 'statuses', 'navigationItems', 'socialMediaPosts', 'sharedLinks'];
          try {
            const batch = writeBatch(firestore);
            
            for (const collectionName of collectionsToDelete) {
              const collRef = collection(firestore, collectionName);
              const snapshot = await getDocs(collRef);
              snapshot.docs.forEach(doc => {
                  batch.delete(doc.ref);
              });
            }
            await batch.commit();

            toast({
              title: 'Application Reset',
              description: `All transactional data has been cleared. User accounts are safe.`
            });

          } catch (e: any) {
            toast({ 
                variant: 'destructive', 
                title: 'Error', 
                description: e.message || 'Could not complete the data reset.' 
            });
          }
           setDeleteConfirmation({isOpen: false, type: '', onConfirm: () => {}});
           setConfirmationInput('');
        }

      setDeleteConfirmation({
        isOpen: true,
        type: 'APP-DATA-RESET',
        onConfirm: confirmAction
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
                        Backup your application data by exporting collections to individual CSV files or a single JSON file.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-wrap gap-4'>
                    <Button onClick={handleExportAllData} variant="default">
                        <Download className="mr-2 h-4 w-4" />
                        Export All Data (JSON)
                    </Button>
                    <Button onClick={handleExportUsers} variant="outline">
                        Export Users (CSV)
                    </Button>
                    <Button onClick={handleExportTasks} variant="outline">
                        Export Tasks (CSV)
                    </Button>
                    <Button onClick={handleExportBrands} variant="outline">
                        Export Brands (CSV)
                    </Button>
                     <Button onClick={handleExportWorkflow} variant="outline">
                        Export Workflow (CSV)
                    </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Manual Job Triggers</CardTitle>
                    <CardDescription>
                        Run scheduled background jobs manually. This is useful for testing or immediate execution.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-wrap gap-4'>
                    <Button onClick={runSchedulerJob} variant="outline" disabled={isJobRunning}>
                        <Send className="mr-2 h-4 w-4" />
                        Run All Scheduled Jobs
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Data Import / Restore</CardTitle>
                    <CardDescription>
                        Panduan untuk melakukan restore data menggunakan file backup.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Fitur import data secara langsung dari aplikasi tidak disediakan untuk menjaga keamanan dan integritas data. Proses restore paling aman dan andal dilakukan melalui konsol Firebase.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Konsol Firebase</a> proyek Anda.</li>
                        <li>Navigasi ke menu <strong>Build &gt; Firestore Database</strong>.</li>
                        <li>Klik ikon titik tiga (opsi) di sebelah tab data Anda, lalu pilih <strong>Import data</strong>.</li>
                        <li>Upload file <code>workwise-backup.json</code> yang sudah Anda unduh sebelumnya.</li>
                        <li>Ikuti instruksi di layar untuk menyelesaikan proses import.</li>
                    </ol>
                </CardContent>
            </Card>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle/>
                        Danger Zone
                    </CardTitle>
                    <CardDescription>
                        Reset the application by deleting all transactional data. 
                        This action is irreversible but will preserve all user accounts and roles.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex gap-4'>
                     <Button variant="destructive" onClick={openDeleteDialog}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Reset Application Data
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
                      This action is irreversible and will delete all transactional application data, including 
                      <strong> tasks, brands, workflow statuses, and navigation settings</strong>.
                      <br/><br/>
                      <strong className="text-foreground">User accounts and permissions will NOT be deleted.</strong> The application will be reset to a "fresh" state, but all users can still log in.
                      <br/><br/>
                      To confirm, please type <code className="font-mono bg-muted text-destructive-foreground p-1 rounded-sm">{deleteConfirmation.type}</code> below.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <Input 
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type ${deleteConfirmation.type}`}
              />
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmationInput('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={deleteConfirmation.onConfirm} 
                    disabled={confirmationInput !== deleteConfirmation.type}
                    className="bg-destructive hover:bg-destructive/90">
                    Confirm Reset
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
