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
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
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
import type { WebArticle, User, Brand, WorkflowStatus } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { DataTableViewOptions } from '../tasks/data-table-view-options';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { WebArticleDetailsSheet } from './web-article-details-sheet';
import { DataTableFacetedFilter } from '../tasks/data-table-faceted-filter';
import { priorityInfo } from '@/lib/utils';
import { Building2, ChevronsUpDown, Circle, CircleDashed, CheckCircle2, Eye, HelpCircle, User as UserIcon, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface WebArticlesDataTableProps {
    articles: WebArticle[];
    statuses: WorkflowStatus[];
    brands: Brand[];
    users: User[];
}

export function WebArticlesDataTable({ articles, statuses, users, brands }: WebArticlesDataTableProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const router = useRouter();
  
  const [data, setData] = React.useState<WebArticle[]>(articles);
  React.useEffect(() => { setData(articles || []); }, [articles]);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'dueDate', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  
  const statusOptions = React.useMemo(() => {
    const getIcon = (statusName: string) => {
        if (statusName === 'To Do') return Circle;
        if (statusName === 'Doing') return CircleDashed;
        if (statusName === 'Preview') return Eye;
        if (statusName === 'Done') return CheckCircle2;
        return HelpCircle;
    };
    return (statuses || []).map(s => ({ value: s.name, label: s.name, icon: getIcon(s.name) }));
  }, [statuses]);

  const priorityOptions = Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label, icon: p.icon }));
  const brandOptions = React.useMemo(() => (brands || []).map(b => ({ value: b.id, label: b.name, icon: Building2 })), [brands]);
  const assigneeOptions = React.useMemo(() => (users || []).map(u => ({ value: u.id, label: u.name })), [users]);


  const columns: ColumnDef<WebArticle>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const article = row.original;
        return (
          <p className="font-medium line-clamp-2">{article.title}</p>
        );
      }
    },
    {
      accessorKey: 'brandId',
      header: 'Brand',
      cell: ({ row }) => {
        const brandId = row.getValue('brandId') as string;
        const brand = brands.find(b => b.id === brandId);
        return brand ? <Badge variant="outline">{brand.name}</Badge> : '-';
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const dueDate = row.getValue('dueDate') as string | undefined;
        return dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : '-';
      }
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.getValue('priority') as WebArticle['priority'];
        const config = priorityInfo[priority];
        if (!config) return '-';
        return (
          <Badge variant="outline" className="font-normal gap-1.5"><config.icon className={cn("h-3 w-3", config.color)} />{config.label}</Badge>
        );
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'assigneeIds',
      header: 'Assignees',
      cell: ({ row }) => {
        const assigneeIds = row.getValue('assigneeIds') as string[] || [];
        const assignees = users.filter(u => assigneeIds.includes(u.id));
        if (assignees.length === 0) return '-';
        return (
          <div className="flex -space-x-2">
            {assignees.slice(0, 3).map(user => (
              <Avatar key={user.id} className="h-7 w-7 border-2 border-background">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback>{user.name?.[0]}</AvatarFallback>
              </Avatar>
            ))}
            {assignees.length > 3 && (
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback>+{assignees.length - 3}</AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const assigneeIds = row.getValue(id) as string[];
        return value.some((val: string) => assigneeIds.includes(val));
      },
    },
    {
      accessorKey: 'statusInternal',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('statusInternal') as string;
        const statusDetails = statuses.find(s => s.name === status);
        const Icon = statusOptions.find(s => s.value === status)?.icon || HelpCircle;
        return (
          <Badge variant="outline" className="font-medium" style={{ backgroundColor: statusDetails ? `${statusDetails.color}20` : 'transparent', borderColor: statusDetails?.color, color: statusDetails?.color }}>
            <div className="flex items-center gap-2">
              <Icon className="h-3 w-3" />
              {status}
            </div>
          </Badge>
        );
      },
       filterFn: (row, id, value) => value.includes(row.getValue(id)),
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
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });
  
  const isFiltered = table.getState().columnFilters.length > 0;

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
          {table.getColumn("brandId") && <DataTableFacetedFilter column={table.getColumn("brandId")} title="Brand" options={brandOptions} />}
          {table.getColumn("statusInternal") && <DataTableFacetedFilter column={table.getColumn("statusInternal")} title="Status" options={statusOptions} />}
          {table.getColumn("priority") && <DataTableFacetedFilter column={table.getColumn("priority")} title="Priority" options={priorityOptions} />}
          {table.getColumn("assigneeIds") && <DataTableFacetedFilter column={table.getColumn("assigneeIds")} title="Assignees" options={assigneeOptions} />}
          {isFiltered && ( <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">Reset <XIcon className="ml-2 h-4 w-4" /></Button>)}
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
                  onClick={() => router.push(`/web/articles/${row.original.id}`)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No articles found.</TableCell></TableRow>
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
