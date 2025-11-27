
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  VisibilityState,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Task, Status, Priority, User } from '@/lib/types';
import { priorityInfo, statusInfo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Plus, Trash2, X as XIcon, Link as LinkIcon, Loader2 } from 'lucide-react';
import { TaskDetailsSheet } from './task-details-sheet';
import { AddTaskDialog } from './add-task-dialog';
import { useI18n } from '@/context/i18n-provider';
import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { DataTableViewOptions } from './data-table-view-options';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { validatePriorityChange } from '@/ai/flows/validate-priority-change';
import { useCollection, useFirestore, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';

type AIValidationState = {
  isOpen: boolean;
  isChecking: boolean;
  reason: string;
  onConfirm: () => void;
};

// Custom sorting function for priorities
const prioritySortingFn = (rowA: any, rowB: any, columnId: string) => {
    const priorityOrder: Record<Priority, number> = { 'Urgent': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
    const priorityA = priorityOrder[rowA.getValue(columnId) as Priority];
    const priorityB = priorityOrder[rowB.getValue(columnId) as Priority];
    if (priorityA > priorityB) return 1;
    if (priorityA < priorityB) return -1;
    return 0;
};


export function TasksDataTable() {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !profile) return null;
    // Admins and Managers see all tasks
    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
      return query(collection(firestore, 'tasks'));
    }
    // Employees only see tasks assigned to them.
    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', profile.id)
    );
  }, [firestore, profile]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const [data, setData] = React.useState<Task[]>([]);
  React.useEffect(() => {
    setData(tasks || []);
  }, [tasks]);

  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: 'priority',
      desc: true,
    },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({})
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [confirmationDialog, setConfirmationDialog] = React.useState<{
    isOpen: boolean;
    task?: Task;
    onConfirm?: () => void;
  }>({ isOpen: false });

  const [aiValidation, setAiValidation] = React.useState<AIValidationState>({ isOpen: false, isChecking: false, reason: '', onConfirm: () => {} });
  const [pendingPriorityChange, setPendingPriorityChange] = React.useState<{ taskId: string, newPriority: Priority } | null>(null);


  const statusOptions = Object.values(statusInfo).map(s => ({
      value: s.value,
      label: t(`status.${s.value.toLowerCase().replace(' ', '')}` as any),
      icon: s.icon
  }));

  const priorityOptions = Object.values(priorityInfo).map(p => ({
      value: p.value,
      label: t(`priority.${p.value.toLowerCase()}` as any),
      icon: p.icon
  }));

  const handleStatusChange = (taskId: string, newStatus: Status) => {
    if (!firestore) return;
    const taskToUpdate = data.find(task => task.id === taskId);
    if (!taskToUpdate) return;
    
    const performUpdate = () => {
        const taskRef = doc(firestore, 'tasks', taskId);
        updateDocumentNonBlocking(taskRef, { status: newStatus });
    };

    if (newStatus === 'Done') {
        setConfirmationDialog({
            isOpen: true,
            task: taskToUpdate,
            onConfirm: () => {
                performUpdate();
                setConfirmationDialog({ isOpen: false });
            },
        });
    } else {
        performUpdate();
    }
  };
  
  const handleDeleteTask = (taskId: string) => {
      if (!firestore) return;
      const taskRef = doc(firestore, 'tasks', taskId);
      deleteDocumentNonBlocking(taskRef);
  };

  const copyTaskLink = (taskId: string) => {
    const link = `${window.location.origin}/tasks/${taskId}`;
    navigator.clipboard.writeText(link);
    toast({
        title: "Link Copied!",
        description: "Task link has been copied to your clipboard.",
    });
  }
  
  const handlePriorityChange = async (taskId: string, newPriority: Priority) => {
    if (!firestore) return;
    const task = data.find(t => t.id === taskId);
    if (!task) return;

    const currentPriority = task.priority;
    const priorityValues: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Urgent': 3 };

    const applyPriorityChange = (id: string, priority: Priority) => {
        const taskRef = doc(firestore, 'tasks', id);
        updateDocumentNonBlocking(taskRef, { priority: priority });
    };

    if (priorityValues[newPriority] <= priorityValues[currentPriority]) {
        applyPriorityChange(taskId, newPriority);
        return;
    }

    setPendingPriorityChange({ taskId, newPriority });
    setAiValidation({ ...aiValidation, isChecking: true });
    try {
        const result = await validatePriorityChange({
            title: task.title,
            description: task.description,
            currentPriority,
            requestedPriority: newPriority,
        });

        if (result.isApproved) {
            applyPriorityChange(taskId, newPriority);
            toast({ title: 'AI Agrees!', description: result.reason });
        } else {
            setAiValidation({
                isOpen: true,
                isChecking: false,
                reason: result.reason,
                onConfirm: () => {
                    applyPriorityChange(taskId, newPriority); 
                    setAiValidation({ ...aiValidation, isOpen: false });
                }
            });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'AI Validation Failed', description: 'Could not validate priority change. Applying directly.' });
        applyPriorityChange(taskId, newPriority);
    } finally {
        setAiValidation(prev => ({ ...prev, isChecking: false }));
        setPendingPriorityChange(null);
    }
  };


  const columns: ColumnDef<Task>[] = [
    {
        id: "actions",
        cell: ({ row }) => {
          const task = row.original
     
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <TaskDetailsSheet task={task} open={false}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>View details</DropdownMenuItem>
                </TaskDetailsSheet>
                <DropdownMenuItem
                  onClick={() => copyTaskLink(task.id)}
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                    className='text-destructive focus:text-destructive focus:bg-destructive/10'
                    onClick={() => handleDeleteTask(task.id)}
                >
                    <Trash2 className='mr-2 h-4 w-4'/>
                    Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    {
      accessorKey: 'title',
      header: t('tasks.column.title'),
      cell: ({ row }) => {
        const task = row.original;
        return (
          <TaskDetailsSheet task={task} open={false}>
            <div className="font-medium cursor-pointer hover:underline">{task.title}</div>
          </TaskDetailsSheet>
        );
      }
    },
    {
      accessorKey: 'status',
      header: t('tasks.column.status'),
      cell: ({ row }) => {
        const task = row.original;
        const currentStatus = row.getValue('status') as Status;
        
        if (profile?.role === 'Super Admin') {
            const status = statusInfo[currentStatus];
            if (!status) return null;
            const Icon = status.icon;
            return (
                <Badge variant="outline" className='font-normal'>
                    <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{t(`status.${status.value.toLowerCase().replace(' ', '')}` as any)}</span>
                </Badge>
            )
        }

        return (
          <Select value={currentStatus} onValueChange={(newStatus: Status) => handleStatusChange(task.id, newStatus)}>
            <SelectTrigger className="w-[140px] border-none bg-secondary focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(statusInfo).map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{t(`status.${s.value.toLowerCase().replace(' ', '')}` as any)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
        accessorKey: 'priority',
        header: t('tasks.column.priority'),
        sortingFn: prioritySortingFn,
        cell: ({ row }) => {
          const task = row.original;
          const currentPriority = row.getValue('priority') as Priority;
          const isChecking = aiValidation.isChecking && pendingPriorityChange?.taskId === task.id;

          if (profile?.role === 'Employee') {
              const priority = priorityInfo[currentPriority];
              if (!priority) return null;
              const Icon = priority.icon;
              return (
                <Badge variant="outline" className='font-normal'>
                    <Icon className={`h-4 w-4 mr-2 ${priority.color}`} />
                    <span>{t(`priority.${priority.value.toLowerCase()}` as any)}</span>
                </Badge>
              )
          }

          return (
            <div className="flex items-center gap-2">
              {isChecking && <Loader2 className="h-4 w-4 animate-spin" />}
              <Select
                value={currentPriority}
                onValueChange={(newPriority: Priority) => handlePriorityChange(task.id, newPriority)}
                disabled={isChecking}
              >
                <SelectTrigger className="w-[140px] border-none bg-secondary focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(priorityInfo).map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <p.icon className={`h-4 w-4 ${p.color}`} />
                        <span>{t(`priority.${p.value.toLowerCase()}` as any)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
    {
      accessorKey: 'assignees',
      header: t('tasks.column.assignees'),
      cell: ({ row }) => {
        const assignees = row.getValue('assignees') as any[] | undefined;
        return (
          <div className="flex -space-x-2">
            <TooltipProvider>
              {assignees?.map((assignee) => (
                <Tooltip key={assignee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                      <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{assignee.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdBy',
      header: 'Dibuat Oleh',
      cell: ({ row }) => {
        const createdBy = row.original.createdBy;
        if (!createdBy) return <div className="text-muted-foreground">-</div>;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={createdBy.avatarUrl} alt={createdBy.name} />
                  <AvatarFallback>{createdBy.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{createdBy.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: 'dueDate',
      header: t('tasks.column.duedate'),
      cell: ({ row }) => {
          const dueDate = row.getValue('dueDate') as string;
          return dueDate ? <div>{format(parseISO(dueDate), 'MMM d, yyyy')}</div> : <div className="text-muted-foreground">-</div>;
      }
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    initialState: {
        pagination: {
            pageSize: 10,
        },
        sorting: [
            {
                id: 'priority',
                desc: true
            }
        ]
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
  });

  const isFiltered = table.getState().columnFilters.length > 0
  const isLoading = isTasksLoading || isProfileLoading;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <Input
              placeholder={t('tasks.filter')}
              value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('title')?.setFilterValue(event.target.value)
              }
              className="h-8 w-[150px] lg:w-[250px]"
            />
            {table.getColumn("status") && (
              <DataTableFacetedFilter
                column={table.getColumn("status")}
                title={t('tasks.column.status')}
                options={statusOptions}
              />
            )}
            {table.getColumn("priority") && (
              <DataTableFacetedFilter
                column={table.getColumn("priority")}
                title={t('tasks.column.priority')}
                options={priorityOptions}
              />
            )}
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <XIcon className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
              <DataTableViewOptions table={table}/>
            <AddTaskDialog>
              <Button size="sm" className="h-8">
                <Plus className="mr-2 h-4 w-4" />
                {t('tasks.createtask')}
              </Button>
            </AddTaskDialog>
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Loading tasks...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t('tasks.noresults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                          table.setPageSize(Number(value))
                      }}
                  >
                      <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                          </SelectItem>
                      ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                  Page {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()}
              </div>
              <div className="flex items-center space-x-2">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                  >
                      Previous
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                  >
                      Next
                  </Button>
              </div>
          </div>
        </div>
      </div>
      <AlertDialog open={confirmationDialog.isOpen} onOpenChange={(isOpen) => setConfirmationDialog({ ...confirmationDialog, isOpen })}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    Do you want to mark the task "{confirmationDialog.task?.title}" as Done?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmationDialog.onConfirm}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={aiValidation.isOpen} onOpenChange={(open) => setAiValidation(prev => ({...prev, isOpen: open}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>AI Priority Guard</AlertDialogTitle>
                <AlertDialogDescription>
                    {aiValidation.reason}
                    <br/><br/>
                    Do you still want to set this task as Urgent?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setAiValidation(prev => ({ ...prev, isOpen: false }))}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                  aiValidation.onConfirm();
                  setAiValidation(prev => ({ ...prev, isOpen: false }));
                }}>Yes, set as Urgent</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
