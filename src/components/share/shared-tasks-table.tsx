
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
import type { Task, Priority, User, WorkflowStatus, Brand, SharedLink, Activity, WorkItem } from '@/lib/types';
import { priorityInfo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { format, parseISO, isAfter } from 'date-fns';
import { X as XIcon, Link as LinkIcon, CheckCircle2, Circle, CircleDashed, Eye, AlertCircle, FileText, Building2, Calendar, Loader2 } from 'lucide-react';
import { DataTableFacetedFilter } from '../tasks/data-table-faceted-filter';
import { DataTableViewOptions } from '../tasks/data-table-view-options';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { useSharedSession } from '@/context/shared-session-provider';

interface SharedTasksTableProps {
    items: WorkItem[];
    statuses: WorkflowStatus[];
    brands: Brand[];
    users: User[];
    accessLevel: SharedLink['accessLevel'];
    workstream: 'tasks' | 'socialMediaPosts' | 'webArticles';
}

export function SharedTasksTable({ items, statuses, brands, users, accessLevel, workstream }: SharedTasksTableProps) {
  const router = useRouter();
  const params = useParams();
  const linkId = params.linkId as string;
  const { session } = useSharedSession();
  
  const [data, setData] = React.useState<WorkItem[]>(items);
  React.useEffect(() => {
    setData(items || []);
  }, [items]);

  const [sorting, setSorting] = React.useState<SortingState>([ { id: 'priority', desc: true } ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({})
  const { toast } = useToast();

  const [updatingCells, setUpdatingCells] = React.useState<Record<string, boolean>>({});
  
  const creatorIsEmployee = session?.creatorRole === 'Employee' || session?.creatorRole === 'PIC';

  const canChangeStatus = accessLevel === 'status' || accessLevel === 'limited-edit';
  const canEditLimited = accessLevel === 'limited-edit';

  const handleCellUpdate = async (itemId: string, updates: Partial<WorkItem>) => {
    setUpdatingCells(prev => ({...prev, [itemId]: true}));
    
    const originalItems = data;

    // Optimistic UI Update
    const updatedItems = data.map(t => t.id === itemId ? { ...t, ...updates } : t);
    setData(updatedItems);

    try {
        const response = await fetch('/api/share/update-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkId, taskId: itemId, updates }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update task from server.');
        }

    } catch (error: any) {
        // Revert UI on failure
        setData(originalItems);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "Your changes could not be saved.",
        });
    } finally {
      setUpdatingCells(prev => ({...prev, [itemId]: false}));
    }
  }

  const statusOptions = React.useMemo(() => {
    const getIcon = (statusName: string) => {
        if (statusName === 'To Do') return Circle;
        if (statusName === 'Doing') return CircleDashed;
        if (statusName === 'Preview') return Eye;
        if (statusName === 'Done') return CheckCircle2;
        return Circle;
    };
    return (statuses || []).map(s => ({ value: s.name, label: s.name, icon: getIcon(s.name) }));
  }, [statuses]);

  const priorityOptions = Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label, icon: p.icon }));
  
  const assigneeOptions = React.useMemo(() => {
    return (users || []).map(u => ({ value: u.id, label: u.name }));
  }, [users]);
  
  const brandOptions = React.useMemo(() => {
    return (brands || []).map(b => ({ value: b.id, label: b.name, icon: Building2 }));
  }, [brands]);

  const columns: ColumnDef<WorkItem>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const item = row.original;
        const hasDescription = typeof item.description === 'string' && item.description.trim() !== '';
        
        const completionStatus = React.useMemo(() => {
            if (item.status !== 'Done' || !item.actualCompletionDate || !item.dueDate) return null;
            const isLate = isAfter(parseISO(item.actualCompletionDate), parseISO(item.dueDate));
            return isLate ? 'Late' : 'On Time';
        }, [item.status, item.actualCompletionDate, item.dueDate]);

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
            <span className="font-medium truncate">{item.title}</span>
            {hasDescription && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{item.description}</p>
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
      header: 'Priority',
      cell: ({ row }) => {
        const item = row.original;
        const currentPriority = row.getValue('priority') as Priority;
        const priority = priorityInfo[currentPriority];
        if (!priority) return null;

        const taskIsFromManager = item.createdBy.id !== session?.creatorId;
        const isPriorityEditable = canEditLimited && !(creatorIsEmployee && taskIsFromManager);

        if (!isPriorityEditable) {
            return (
              <Badge variant="outline" className='font-normal'>
                  <priority.icon className={`h-4 w-4 mr-2 ${priority.color}`} />
                  <span>{priority.label}</span>
              </Badge>
            )
        }
        
        return (
             <Select
              value={currentPriority}
              onValueChange={(newPriority: Priority) => handleCellUpdate(item.id, { priority: newPriority })}
              disabled={updatingCells[item.id]}
            >
              <SelectTrigger className="w-[140px] border-none bg-transparent focus:ring-0">
                 <div className="flex items-center gap-2">
                    <priority.icon className={`h-4 w-4 ${priority.color}`} />
                    <span>{priority.label}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {Object.values(priorityInfo).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <p.icon className={`h-4 w-4 ${p.color}`} />
                      <span>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'assigneeIds',
      header: 'Assignees',
      cell: ({ row }) => {
        const assigneeIds = row.original.assigneeIds || [];
        if (assigneeIds.length === 0) {
            return <div className="text-muted-foreground">-</div>;
        }
        
        const assignees = assigneeIds.map(id => users?.find(u => u.id === id)).filter(Boolean) as User[];
        const firstAssignee = assignees[0];
        if (!firstAssignee) return <div className="text-muted-foreground">-</div>;

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
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const item = row.original;
        const dueDate = item.dueDate;

        const taskIsFromManager = item.createdBy.id !== session?.creatorId;
        const isDateEditable = canEditLimited && !(creatorIsEmployee && taskIsFromManager);

        if (!isDateEditable) {
          return dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : <span className="text-muted-foreground">-</span>;
        }

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"ghost"}
                className="w-[150px] justify-start text-left font-normal"
                disabled={updatingCells[item.id]}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : <span>Set date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={dueDate ? parseISO(dueDate) : undefined}
                onSelect={(date) => handleCellUpdate(item.id, { dueDate: date?.toISOString() })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        const statusName = item.status;
        const statusDetails = statuses?.find(s => s.name === statusName);
        const Icon = statusOptions.find(s => s.value === statusName)?.icon || Circle;

        if (!canChangeStatus) {
           return (
              <Badge variant="outline" className="font-medium" style={{ backgroundColor: statusDetails ? `${statusDetails.color}20` : 'transparent', borderColor: statusDetails?.color, color: statusDetails?.color }}>
                  <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3" />
                      <span>{statusName}</span>
                  </div>
              </Badge>
            );
        }

        return (
            <Select 
                value={statusName} 
                onValueChange={(newStatus) => handleCellUpdate(item.id, { status: newStatus })}
                disabled={updatingCells[item.id]}
            >
                <SelectTrigger className="w-[140px] border-none bg-transparent focus:ring-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3" style={{ color: statusDetails?.color }} />
                      <span>{statusName}</span>
                    </div>
                </SelectTrigger>
                <SelectContent>
                    {(statuses || []).map(s => (
                        <SelectItem 
                          key={s.id} 
                          value={s.name}
                          disabled={creatorIsEmployee && (s.name === 'Done' || s.name === 'Revisi')}
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                                {s.name}
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
        pagination: { pageSize: 10 },
        sorting: [{ id: 'priority', desc: true }]
    },
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  const isFiltered = table.getState().columnFilters.length > 0;
  
  const getBasePath = () => {
    switch (workstream) {
      case 'socialMediaPosts': return 'social-media/posts';
      case 'webArticles': return 'web/articles';
      default: return 'tasks';
    }
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
            <Input
                placeholder="Filter by title..."
                value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
                onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
                className="h-8 w-[150px] lg:w-[250px]"
            />
            {brandOptions.length > 0 && <DataTableFacetedFilter column={table.getColumn("brandId")} title="Brand" options={brandOptions} />}
            {statusOptions.length > 0 && <DataTableFacetedFilter column={table.getColumn("status")} title="Status" options={statusOptions} />}
            {priorityOptions.length > 0 && <DataTableFacetedFilter column={table.getColumn("priority")} title="Priority" options={priorityOptions} />}
            {assigneeOptions.length > 0 && <DataTableFacetedFilter column={table.getColumn("assigneeIds")} title="Assignees" options={assigneeOptions} />}
            {isFiltered && (
                <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
                Reset <XIcon className="ml-2 h-4 w-4" />
                </Button>
            )}
            </div>
            <DataTableViewOptions table={table} />
        </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="group cursor-pointer"
                  onClick={() => {
                      const item = row.original;
                      const path = `/share/${linkId}/${getBasePath()}/${item.id}`;
                      router.push(path);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
      </div>
    </div>
  );
}
