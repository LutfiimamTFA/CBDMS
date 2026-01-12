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
import type { SocialMediaPost, User, Brand } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Trash2, CheckCircle, Clock, HelpCircle, RefreshCcw, AlertTriangle, Instagram } from 'lucide-react';
import { DataTableViewOptions } from '../tasks/data-table-view-options';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '../ui/badge';
import { CreatePostDialog } from './create-post-dialog';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { icon: React.ElementType, label: string, color: string }> = {
    Draft: { icon: HelpCircle, label: 'Draft', color: 'bg-gray-400 border-gray-400 text-white' },
    'Needs Approval': { icon: HelpCircle, label: 'Needs Approval', color: 'bg-yellow-500 border-yellow-500 text-yellow-900' },
    'Needs Revision': { icon: RefreshCcw, label: 'Needs Revision', color: 'bg-orange-500 border-orange-500 text-white' },
    Scheduled: { icon: Clock, label: 'Scheduled', color: 'bg-blue-500 border-blue-500 text-white' },
    Posted: { icon: CheckCircle, label: 'Posted', color: 'bg-green-500 border-green-500 text-white' },
    Error: { icon: AlertTriangle, label: 'Error', color: 'bg-red-500 border-red-500 text-white' },
};

interface SocialMediaDataTableProps {
    posts: SocialMediaPost[];
    users: User[];
    brands: Brand[];
}

export function SocialMediaDataTable({ posts, users, brands }: SocialMediaDataTableProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  
  const [data, setData] = React.useState<SocialMediaPost[]>(posts);
  React.useEffect(() => { setData(posts || []); }, [posts]);

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'scheduledAt', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const { toast } = useToast();
  
  const [pendingDeletePost, setPendingDeletePost] = React.useState<SocialMediaPost | null>(null);
  const [editingPost, setEditingPost] = React.useState<SocialMediaPost | null>(null);

  const handleDeletePost = (postId: string) => {
      if (!firestore) return;
      const postRef = doc(firestore, 'socialMediaPosts', postId);
      deleteDocumentNonBlocking(postRef);
      toast({ title: "Post Deleted", description: "The social media post is being removed." });
  };
  
  const columns: ColumnDef<SocialMediaPost>[] = [
    {
      accessorKey: 'caption',
      header: 'Caption',
      cell: ({ row }) => {
        const post = row.original;
        const brand = brands.find(b => b.id === post.brandId);
        return (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-md overflow-hidden shrink-0">
              {post.mediaUrl && <img src={post.mediaUrl} alt="Post media" className="w-full h-full object-cover" />}
            </div>
            <div>
              <p className="font-medium line-clamp-2">{post.caption}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {brand && <span>{brand.name}</span>}
                <div className="flex items-center gap-1"><Instagram className="h-3 w-3" /><span>{post.platform}</span></div>
              </div>
            </div>
          </div>
        );
      }
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
      }
    },
    {
      accessorKey: 'scheduledAt',
      header: 'Scheduled At',
      cell: ({ row }) => {
        const scheduledAt = row.getValue('scheduledAt') as string | undefined;
        return scheduledAt ? format(parseISO(scheduledAt), 'MMM d, yyyy, p') : '-';
      }
    },
    {
      accessorKey: 'createdBy',
      header: 'Creator',
      cell: ({ row }) => {
        const userId = row.getValue('createdBy') as string;
        const user = users.find(u => u.id === userId);
        return user ? user.name : 'Unknown';
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const post = row.original;
        const isCreator = profile?.id === post.createdBy;
        const isManager = profile?.role === 'Manager' || profile?.role === 'Super Admin';
        const canDelete = isManager || (isCreator && post.status === 'Draft');

        return (
          <CreatePostDialog post={post}>
             <Button variant="outline" size="sm">View</Button>
          </CreatePostDialog>
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
            placeholder="Filter by caption..."
            value={(table.getColumn('caption')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('caption')?.setFilterValue(event.target.value)}
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
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No posts found.</TableCell></TableRow>
              )}
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post: "{pendingDeletePost?.caption.substring(0, 50)}...".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (pendingDeletePost) handleDeletePost(pendingDeletePost.id);
                setPendingDeletePost(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
