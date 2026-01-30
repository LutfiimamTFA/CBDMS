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
import { useFirestore, useUserProfile } from '@/firebase';
import { Badge } from '../ui/badge';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { WebArticleDetailsSheet } from './web-article-details-sheet';
import { DataTableFacetedFilter } from '../tasks/data-table-faceted-filter';
import { priorityInfo } from '@/lib/utils';
import { Building2, ChevronsUpDown, Circle, CircleDashed, CheckCircle2, Eye, HelpCircle, User as UserIcon, X as XIcon, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';


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
  const { toast } = useToast();
  
  const [data, setData] = React.useState<WebArticle[]>(articles);
  const [pendingDeleteArticle, setPendingDeleteArticle] = React.useState<WebArticle | null>(null);

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
  
  const handleDeleteArticle = () => {
    if (!firestore || !pendingDeleteArticle) return;
    deleteDocumentNonBlocking(doc(firestore, 'webArticles', pendingDeleteArticle.id));
    toast({ title: "Article Deleted", description: `The article "${pendingDeleteArticle.title}" is being removed.` });
    setPendingDeleteArticle(null);
  };


  const columns: ColumnDef<WebArticle>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Title
            <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const article = row.original;
        return (
          <p className="font-medium">{article.title}</p>
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
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Due Date
            <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
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
        const assignees = row.original.assignees || [];
        if (assignees.length === 0) {
            const assigneeIds = row.original.assigneeIds || [];
            const foundUsers = users.filter(u => assigneeIds.includes(u.id));
            if (foundUsers.length === 0) return <div className="text-muted-foreground">-</div>;
            
            const firstUser = foundUsers[0];
            return (
                 <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className='flex items-center gap-2'>
                                    <Avatar className="h-7 w-7 border-2 border-background">
                                    <AvatarImage src={firstUser.avatarUrl} alt={firstUser.name} />
                                    <AvatarFallback>{firstUser.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium truncate max-w-[120px]">{firstUser.name}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{firstUser.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {foundUsers.length > 1 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="secondary" className="cursor-default">+{foundUsers.length - 1}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {foundUsers.slice(1).map(u => <p key={u.id}>{u.name}</p>)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )
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
                    <span className="font-medium truncate max-w-[120px]">{firstAssignee.name}</span>
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
                    {assignees.slice(1).map(u => <p key={u.id}>{u.name}</p>)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
    {
      id: "actions",
      cell: ({ row }) => {
        const article = row.original;
        const canDelete = React.useMemo(() => {
            if (!profile) return false;
            if (profile.role === 'Super Admin' || profile.role === 'Manager') return true;
            if ((profile.role === 'Employee' || profile.role === 'PIC') && article.createdBy?.id === profile.id) return true;
            return false;
        }, [profile, article.createdBy]);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 opacity-50 focus:opacity-100 group-hover:opacity-100 transition-opacity">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); router.push(`/web/articles/${article.id}`)}}>
                View details
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); setPendingDeleteArticle(article); }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Article
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });
  
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <>
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
                  className="cursor-pointer group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} onClick={(e) => cell.column.id === 'actions' && e.stopPropagation()}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
     <AlertDialog open={!!pendingDeleteArticle} onOpenChange={() => setPendingDeleteArticle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the article: <strong className="text-foreground">{pendingDeleteArticle?.title}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteArticle}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Delete Article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
