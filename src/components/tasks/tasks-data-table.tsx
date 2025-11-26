
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
import { tasks as initialData } from '@/lib/data';
import type { Task, Status } from '@/lib/types';
import { priorityInfo, statusInfo } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Plus, Trash2, X as XIcon } from 'lucide-react';
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


export function TasksDataTable() {
  const [data, setData] = React.useState<Task[]>(initialData);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({})
  const { t } = useI18n();
  
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
    setData(prevData => prevData.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));
  };
  
  const handleDeleteTask = (taskId: string) => {
      setData(prevData => prevData.filter(task => task.id !== taskId));
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
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(task.id)}
                >
                  Copy task ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <TaskDetailsSheet task={task}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>View details</DropdownMenuItem>
                </TaskDetailsSheet>
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
          <TaskDetailsSheet task={task}>
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
      cell: ({ row }) => {
        const priority = row.getValue('priority') as keyof typeof priorityInfo;
        const Icon = priorityInfo[priority].icon;
        const color = priorityInfo[priority].color;
        const translationKey = `priority.${priority.toLowerCase()}` as any;
        return (
           <div className="flex w-[100px] items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm">
              <Icon className={`h-4 w-4 ${color}`} />
              <span>{t(translationKey)}</span>
           </div>
        );
      },
       filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'assignees',
      header: t('tasks.column.assignees'),
      cell: ({ row }) => {
        const assignees = row.getValue('assignees') as any[];
        return (
          <div className="flex -space-x-2">
            <TooltipProvider>
              {assignees.map((assignee) => (
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
            pageSize: 5,
        },
        columnFilters: [
            {
                id: 'status',
                value: ['To Do', 'Doing']
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

  return (
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
            {table.getRowModel().rows?.length ? (
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
                    {[5, 10, 20, 30, 40, 50].map((pageSize) => (
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
  );
}
    
