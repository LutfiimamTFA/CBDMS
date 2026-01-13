
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
import { MoreHorizontal, Trash2, CheckCircle, Clock, HelpCircle, RefreshCcw, AlertTriangle, Instagram } from 'lucide-react';
import { DataTableViewOptions } from '../tasks/data-table-view-options';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';
import { AddWebArticleDialog } from '@/components/web/add-web-article-dialog';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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
  const { toast } = useToast();
  
  const [pendingDeleteArticle, setPendingDeleteArticle] = React.useState<WebArticle | null>(null);

  const handleDeleteArticle = (articleId: string) => {
      if (!firestore) return;
      const articleRef = doc(firestore, 'webArticles', articleId);
      deleteDocumentNonBlocking(articleRef);
      toast({ title: "Article Deleted", description: "The article is being removed." });
  };
  
  const columns: ColumnDef<WebArticle>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const article = row.original;
        return (
          <div className="flex items-center gap-4">
            <div>
              <p className="font-medium line-clamp-2">{article.title}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {brands.find(b => b.id === article.brandId)?.name}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'statusInternal',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('statusInternal') as string;
        const statusDetails = statuses.find(s => s.name === status);
        return (
          <Badge variant="outline" className="font-medium" style={{ backgroundColor: statusDetails ? `${statusDetails.color}20` : 'transparent', borderColor: statusDetails?.color, color: statusDetails?.color }}>
            {status}
          </Badge>
        );
      }
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
        accessorKey: 'assigneeIds',
        header: 'Assignees',
        cell: ({ row }) => {
          const assigneeIds = row.getValue('assigneeIds') as string[] || [];
          const assignees = users.filter(u => assigneeIds.includes(u.id));
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
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const article = row.original;
        const canDelete = profile?.role === 'Super Admin' || profile?.role === 'Manager' || profile?.id === article.createdBy?.id;

        return (
            <Button variant="outline" size="sm" onClick={(e) => {
                e.stopPropagation();
                router.push(`/web/articles/${article.id}`);
            }}>
                View
            </Button>
        );
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
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Filter by title..."
            value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
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
    </>
  );
}
