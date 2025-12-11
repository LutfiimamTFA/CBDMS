
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
import type { Task, Priority, User } from '@/lib/types';
import { priorityInfo } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '../ui/badge';
import Link from 'next/link';

// Custom sorting function for priorities
const prioritySortingFn = (rowA: any, rowB: any, columnId: string) => {
    const priorityOrder: Record<Priority, number> = { 'Urgent': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
    const priorityA = priorityOrder[rowA.getValue(columnId) as Priority];
    const priorityB = priorityOrder[rowB.getValue(columnId) as Priority];
    return priorityA - priorityB;
};

const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <Link href={`/tasks/${task.id}`} className="font-medium cursor-pointer hover:underline">
            {task.title}
          </Link>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
       cell: ({ row }) => {
        const status = row.getValue('status') as string;
        // A simple badge for status in this read-only view.
        return <Badge variant="secondary">{status}</Badge>;
      }
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      sortingFn: prioritySortingFn,
      cell: ({ row }) => {
        const priority = row.getValue('priority') as Priority;
        const info = priorityInfo[priority];
        if (!info) return null;
        const Icon = info.icon;
        return (
            <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${info.color}`} />
                <span>{info.label}</span>
            </div>
        );
      }
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const dueDate = row.getValue('dueDate') as string | undefined;
        return dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : <span className='text-muted-foreground'>-</span>;
      }
    },
];

export function MyTasksDataTable() {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();

  const [sorting, setSorting] = React.useState<SortingState>([ { id: 'priority', desc: true } ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const usersQuery = React.useMemo(() => {
    if (!firestore || !profile || profile.role !== 'Manager') return null;
    return query(collection(firestore, 'users'), where('managerId', '==', profile.id));
  }, [firestore, profile]);
  const { data: teamUsers, isLoading: isTeamLoading } = useCollection<User>(usersQuery);

  const tasksQuery = React.useMemo(() => {
    if (!firestore || !profile) return null;

    if (profile.role === 'Manager') {
      const teamMemberIds = (teamUsers || []).map(u => u.id);
      const allRelevantIds = [...teamMemberIds, profile.id];
      if (allRelevantIds.length === 0) return null;
      return query(
        collection(firestore, 'tasks'),
        where('assigneeIds', 'array-contains-any', allRelevantIds)
      );
    }
    
    // For Employee
    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', profile.id)
    );
  }, [firestore, profile, teamUsers]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const table = useReactTable({
    data: tasks || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });
  
  const isLoading = isProfileLoading || isTasksLoading || (profile?.role === 'Manager' && isTeamLoading);

  return (
    <div className="space-y-4">
        <div className="flex items-center">
            <Input
              placeholder="Filter tasks by title..."
              value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('title')?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
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
                      <span>Loading your tasks...</span>
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
                  No tasks assigned to you.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       <div className="flex items-center justify-end space-x-2 py-4">
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
  );
}


