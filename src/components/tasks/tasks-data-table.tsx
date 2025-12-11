
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
import type { Task, Priority, User, Notification, WorkflowStatus, Brand, Activity } from '@/lib/types';
import { priorityInfo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { format, parseISO, isAfter } from 'date-fns';
import { MoreHorizontal, Plus, Trash2, X as XIcon, Link as LinkIcon, Loader2, CheckCircle2, Circle, CircleDashed, Building2, History, Eye, AlertCircle, FileText } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { validatePriorityChange } from '@/ai/flows/validate-priority-change';
import { useFirestore, useUserProfile } from '@/firebase';
import { collection, doc, query, where, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';
import { usePermissions } from '@/context/permissions-provider';
import Link from 'next/link';
import { useSharedSession } from '@/context/shared-session-provider';

type AIValidationState = {
  isOpen: boolean;
  isChecking: boolean;
  reason: string;
  onConfirm: () => void;
};

// Custom sorting function for priorities
const prioritySortingFn = (row: any, rowB: any, columnId: string) => {
    const priorityOrder: Record<Priority, number> = { 'Urgent': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
    const priorityA = priorityOrder[row.getValue(columnId) as Priority];
    const priorityB = priorityOrder[rowB.getValue(columnId) as Priority];
    if (priorityA > priorityB) return 1;
    if (priorityA < priorityB) return -1;
    return 0;
};

interface TasksDataTableProps {
    tasks: Task[];
    statuses: WorkflowStatus[];
    brands: Brand[];
    users: User[];
}

export function TasksDataTable({ tasks, statuses, brands, users }: TasksDataTableProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();
  const { session } = useSharedSession();
  
  const [data, setData] = React.useState<Task[]>(tasks);
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    lastActivity: false,
  });
  const [rowSelection, setRowSelection] = React.useState({})
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [aiValidation, setAiValidation] = React.useState<AIValidationState>({ isOpen: false, isChecking: false, reason: '', onConfirm: () => {} });
  const [pendingPriorityChange, setPendingPriorityChange] = React.useState<{ taskId: string, newPriority: Priority } | null>(null);
  
  const [historyTask, setHistoryTask] = React.useState<Task | null>(null);

  const statusOptions = React.useMemo(() => {
    const getIcon = (statusName: string) => {
        if (statusName === 'To Do') return Circle;
        if (statusName === 'Doing') return CircleDashed;
        if (statusName === 'Preview') return Eye;
        if (statusName === 'Done') return CheckCircle2;
        return Circle;
    };

    if (profile?.role === 'Employee') {
        return (statuses || []).filter(s => s.name !== 'Done').map(s => ({
            value: s.name,
            label: s.name,
            icon: getIcon(s.name),
        }));
    }

    return (statuses || []).map(s => ({
        value: s.name,
        label: s.name,
        icon: getIcon(s.name),
    }));
  }, [statuses, profile]);

  const priorityOptions = Object.values(priorityInfo).map(p => ({
      value: p.value,
      label: t(`priority.${p.value.toLowerCase()}` as any),
      icon: p.icon
  }));
  
  const brandOptions = React.useMemo(() => {
    return (brands || []).map((brand) => ({
      value: brand.id,
      label: brand.name,
      icon: Building2,
    }));
  }, [brands]);

  const assigneeOptions = React.useMemo(() => {
    if (!users || !profile) return [];
    
    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
        return users
            .filter(u => u.role === 'Manager' || u.role === 'Employee')
            .map(u => ({ value: u.id, label: u.name }));
    }
    
    return users
        .filter(u => u.role === 'Employee')
        .map(u => ({ value: u.id, label: u.name }));
        
  }, [users, profile]);


  const createActivity = (user: User, action: string): Activity => {
    return {
      id: `act-${Date.now()}`,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
      action: action,
      timestamp: new Date().toISOString(),
    };
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
    if (!firestore || !profile) return;
    const task = data.find(t => t.id === taskId);
    if (!task) return;

    const currentPriority = task.priority;
    const priorityValues: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Urgent': 3 };

    const applyPriorityChange = (id: string, priority: Priority) => {
        const taskRef = doc(firestore, 'tasks', id);
        const newActivity = createActivity(profile, `set priority from "${currentPriority}" to "${priority}"`);
        const updatedActivities = [...(task.activities || []), newActivity];
        
        updateDocumentNonBlocking(taskRef, {
            priority: priority,
            activities: updatedActivities,
            lastActivity: newActivity,
            updatedAt: serverTimestamp(),
        });
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

  const canCreateTasks = React.useMemo(() => {
    if (session) return false;
    if (arePermsLoading || !profile || !permissions) return false;
    if (profile.role === 'Super Admin') return true;
    if (profile.role === 'Manager') return permissions.Manager.canCreateTasks;
    if (profile.role === 'Employee') return permissions.Employee.canCreateTasks;
    return false;
  }, [profile, permissions, arePermsLoading, session]);


  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: t('tasks.column.title'),
      cell: ({ row }) => {
        const task = row.original;
        const hasDescription = task.description && task.description.trim() !== '';
        
        const completionStatus = React.useMemo(() => {
            if (task.status !== 'Done' || !task.actualCompletionDate || !task.dueDate) return null;
            const isLate = isAfter(parseISO(task.actualCompletionDate), parseISO(task.dueDate));
            return isLate ? 'Late' : 'On Time';
        }, [task.status, task.actualCompletionDate, task.dueDate]);

        return (
          <div className="flex items-center gap-2 max-w-xs">
             {completionStatus && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            {completionStatus === 'On Time' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                            )}
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Completed {completionStatus}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <Link href={session ? `/share/${session.linkId}/${task.id}` : `/tasks/${task.id}`} className="font-medium cursor-pointer hover:underline truncate">{task.title}</Link>
            {hasDescription && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{task.description}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'brandId',
      header: 'Brand',
      cell: ({ row }) => {
        const brandId = row.getValue('brandId') as string;
        const brand = brands?.find(b => b.id === brandId);
        return brand ? <Badge variant="outline" className="font-normal bg-secondary/50"><Building2 className='mr-2 h-4 w-4'/>{brand.name}</Badge> : <div className="text-muted-foreground">-</div>;
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
        
        const priority = priorityInfo[currentPriority];
        if (!priority) return null;

        if (profile?.role === 'Employee' || session) {
            return (
              <Badge variant="outline" className='font-normal'>
                  <priority.icon className={`h-4 w-4 mr-2 ${priority.color}`} />
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
              disabled={isChecking || profile?.role === 'Employee'}
            >
              <SelectTrigger className="w-[140px] border-none bg-transparent focus:ring-0">
                 <div className="flex items-center gap-2">
                    <priority.icon className={`h-4 w-4 ${priority.color}`} />
                    <span>{t(`priority.${priority.value.toLowerCase()}` as any)}</span>
                </div>
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
      accessorKey: 'assigneeIds',
      header: t('tasks.column.assignees'),
      cell: ({ row }) => {
        const assignees = row.original.assignees || [];
        if (!assignees || assignees.length === 0) {
            return <div className="text-muted-foreground">-</div>;
        }
        const firstAssignee = assignees[0];

        return (
          <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='flex items-center gap-2'>
                            <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={firstAssignee.avatarUrl} alt={firstAssignee.name} />
                            <AvatarFallback>{firstAssignee.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{firstAssignee.name}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{firstAssignee.name}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {assignees.length > 1 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-default">+{assignees.length - 1}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            {assignees.slice(1).map(a => <p key={a.id}>{a.name}</p>)}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
          </div>
        );
      },
       filterFn: (row, id, value) => {
        const assigneeIds = row.original.assigneeIds;
        return value.some((val: string) => assigneeIds.includes(val));
      },
    },
    {
      accessorKey: 'status',
      header: t('tasks.column.status'),
      cell: ({ row }) => {
        const statusName = row.getValue('status') as string;
        const statusDetails = statuses?.find(s => s.name === statusName);
        
        const Icon = statusOptions.find(s => s.value === statusName)?.icon || Circle;

        return (
          <Badge variant="outline" className="font-medium" style={{
              backgroundColor: statusDetails ? `${statusDetails.color}20` : 'transparent',
              borderColor: statusDetails?.color,
              color: statusDetails?.color
          }}>
              <div className="flex items-center gap-2">
                  <Icon className="h-3 w-3" />
                  <span>{statusName}</span>
              </div>
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const task = row.original;
        
        if (session) return null; // No actions in shared view

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 p-0 opacity-50 focus:opacity-100 group-hover:opacity-100 transition-opacity">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <Link href={`/tasks/${task.id}`}><DropdownMenuItem onSelect={(e) => e.preventDefault()}>View details</DropdownMenuItem></Link>
              <DropdownMenuItem onClick={() => setHistoryTask(task)}>
                  <History className="mr-2 h-4 w-4" />
                  View History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyTaskLink(task.id)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive focus:text-destructive focus:bg-destructive/10'
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
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

  const isFiltered = table.getState().columnFilters.length > 0;

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
            {table.getColumn("brandId") && (
              <DataTableFacetedFilter
                column={table.getColumn("brandId")}
                title="Brand"
                options={brandOptions}
              />
            )}
             {table.getColumn("assigneeIds") && (
              <DataTableFacetedFilter
                column={table.getColumn("assigneeIds")}
                title={t('tasks.column.assignees')}
                options={assigneeOptions}
              />
            )}
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
            {canCreateTasks && (
              <AddTaskDialog>
                <Button size="sm" className="h-8">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('tasks.createtask')}
                </Button>
              </AddTaskDialog>
            )}
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="group"
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
       <Dialog open={!!historyTask} onOpenChange={() => setHistoryTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Activity Log: {historyTask?.title}</DialogTitle>
            <DialogDescription>
              A complete history of all changes made to this task.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-6 py-4">
              {historyTask && historyTask.activities && historyTask.activities.length > 0 ? (
                historyTask.activities
                  .slice()
                  .sort((a, b) => {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return dateB - dateA;
                  })
                  .map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} />
                        <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold">{activity.user.name}</span> {activity.action}.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.timestamp ? format(new Date(activity.timestamp), 'PP, HH:mm') : 'just now'}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No activities recorded for this task yet.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
