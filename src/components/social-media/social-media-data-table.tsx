
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
import type { SocialMediaPost, User, Brand, WorkflowStatus } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Trash2, CheckCircle, Clock, HelpCircle, RefreshCcw, AlertTriangle, Instagram, Building2, User as UserIcon, X as XIcon, ChevronsUpDown, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { DataTableViewOptions } from '../tasks/data-table-view-options';
import { DataTableFacetedFilter } from '../tasks/data-table-faceted-filter';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { priorityInfo } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const statusConfig: Record<string, { icon: React.ElementType, label: string, color: string }> = {
    'To Do': { icon: HelpCircle, label: 'To Do', color: 'bg-gray-400 border-gray-400 text-white' },
    'Doing': { icon: Clock, label: 'Doing', color: 'bg-blue-500 border-blue-500 text-white' },
    'Preview': { icon: Instagram, label: 'Preview', color: 'bg-purple-500 border-purple-500 text-white' },
    'Revisi': { icon: RefreshCcw, label: 'Revisi', color: 'bg-orange-500 border-orange-500 text-white' },
    'Done': { icon: CheckCircle, label: 'Done', color: 'bg-green-500 border-green-500 text-white' },
    // Legacy statuses
    Draft: { icon: HelpCircle, label: 'Draft', color: 'bg-gray-400 border-gray-400 text-white' },
    'Needs Approval': { icon: HelpCircle, label: 'Needs Approval', color: 'bg-yellow-500 border-yellow-500 text-yellow-900' },
    Scheduled: { icon: Clock, label: 'Scheduled', color: 'bg-blue-500 border-blue-500 text-white' },
    Posted: { icon: CheckCircle, label: 'Posted', color: 'bg-green-500 border-green-500 text-white' },
    Error: { icon: AlertTriangle, label: 'Error', color: 'bg-red-500 border-red-500 text-white' },
};


interface SocialMediaDataTableProps {
    posts: SocialMediaPost[];
    users: User[];
    brands: Brand[];
    brandMap: Map<string, string>;
    statuses: WorkflowStatus[];
}

export function SocialMediaDataTable({ posts, users, brands, brandMap, statuses }: SocialMediaDataTableProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const router = useRouter();
  const { toast } = useToast();
  
  const [data, setData] = React.useState<SocialMediaPost[]>(posts);
  const [pendingDeletePost, setPendingDeletePost] = React.useState<SocialMediaPost | null>(null);

  React.useEffect(() => { setData(posts || []); }, [posts]);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'dueDate', desc: false }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  
  const statusOptions = React.useMemo(() => {
    return (statuses || []).map(s => ({ value: s.name, label: s.name, icon: statusConfig[s.name]?.icon || HelpCircle }));
  }, [statuses]);

  const priorityOptions = Object.values(priorityInfo).map(p => ({ value: p.value, label: p.label, icon: p.icon }));
  const brandOptions = React.useMemo(() => brands.map(b => ({ value: b.id, label: b.name, icon: Building2 })), [brands]);
  const assigneeOptions = React.useMemo(() => users.map(u => ({ value: u.id, label: u.name, icon: UserIcon })), [users]);
  
  const handleDeletePost = () => {
    if (!firestore || !pendingDeletePost) return;
    deleteDocumentNonBlocking(doc(firestore, 'socialMediaPosts', pendingDeletePost.id));
    toast({ title: "Post Deleted", description: `The post "${pendingDeletePost.title}" is being removed.` });
    setPendingDeletePost(null);
  };
  
  const columns: ColumnDef<SocialMediaPost>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Title
          <ChevronsUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const post = row.original;
        return (
            <p className="font-medium break-words">{post.title}</p>
        );
      }
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
        return <div className="text-left font-medium">{dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : <span className="text-muted-foreground">-</span>}</div>;
      }
    },
     {
      accessorKey: 'brandId',
      header: 'Brand',
      cell: ({ row }) => {
        const brandId = row.getValue('brandId') as string;
        const brandName = brandMap.get(brandId) || 'Restricted';
        return <span className="font-medium">{brandName}</span>;
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
          const priority = row.getValue('priority') as SocialMediaPost['priority'];
          const config = priorityInfo[priority];
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
        
        if (assignees.length === 0) {
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
                            <AvatarFallback>{firstAssignee.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[120px]">{firstAssignee.name}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent><p>{firstAssignee.name}</p></TooltipContent>
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const config = statusConfig[status] || { icon: HelpCircle, label: status, color: 'bg-gray-400' };
        return (
          <Badge className={cn('gap-1.5', config.color)}>
            <config.icon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
       filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const post = row.original;
        const canDelete = React.useMemo(() => {
            if (!profile) return false;
            if (profile.role === 'Super Admin' || profile.role === 'Manager') return true;
            if ((profile.role === 'Employee' || profile.role === 'PIC') && post.createdBy?.id === profile.id) return true;
            return false;
        }, [profile, post.createdBy]);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 opacity-50 focus:opacity-100 group-hover:opacity-100 transition-opacity">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); router.push(`/social-media/posts/${post.id}`)}}>
                View details
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); setPendingDeletePost(post); }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Post
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
                  {table.getColumn("status") && <DataTableFacetedFilter column={table.getColumn("status")} title="Status" options={statusOptions} />}
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
                          <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => (<TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>))}</TableRow>
                      ))}
                  </TableHeader>
                  <TableBody>
                      {table.getRowModel().rows?.length ? (
                          table.getRowModel().rows.map((row) => (
                              <TableRow 
                                  key={row.id} 
                                  data-state={row.getIsSelected() && 'selected'}
                                  onClick={() => router.push(`/social-media/posts/${row.original.id}`)}
                                  className="cursor-pointer group"
                              >
                                  {row.getVisibleCells().map((cell) => (
                                      <TableCell key={cell.id} onClick={(e) => cell.column.id === 'actions' && e.stopPropagation()}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                  ))}
                              </TableRow>
                          ))
                      ) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No posts found.</TableCell></TableRow>)}
                  </TableBody>
              </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
          </div>
      </div>
      <AlertDialog open={!!pendingDeletePost} onOpenChange={() => setPendingDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post: <strong className="text-foreground">{pendingDeletePost?.title}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePost}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Delete Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
