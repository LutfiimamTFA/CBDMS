'use client';
import React from 'react';
import type { SocialMediaPost, User } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Instagram, FileText, Clapperboard, RefreshCcw, AlertTriangle, HelpCircle, CheckCircle, Clock, History, Calendar, UploadCloud } from 'lucide-react';
import { format, parseISO, formatDistanceToNow, endOfDay, isAfter } from 'date-fns';
import { cn, priorityInfo, formatLateness } from '@/lib/utils';
import { useState } from 'react';
import { SocialMediaPostDetailsSheet } from './social-media-details-sheet';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';


interface SocialPostCardProps {
  post: SocialMediaPost;
  allUsers: User[];
}

const statusConfig: Record<string, { color: string; icon: React.ElementType, label: string }> = {
    Draft: { color: 'bg-gray-400 border-gray-400 text-white', icon: HelpCircle, label: 'Draft' },
    'Needs Approval': { color: 'bg-yellow-500 border-yellow-500 text-yellow-900', icon: HelpCircle, label: 'Needs Approval' },
    'Needs Revision': { color: 'bg-orange-500 border-orange-500 text-white', icon: RefreshCcw, label: 'Needs Revision' },
    Scheduled: { color: 'bg-blue-500 border-blue-500 text-white', icon: Clock, label: 'Scheduled' },
    Publishing: { color: 'bg-blue-400 border-blue-400 text-white animate-pulse', icon: HelpCircle, label: 'Publishing' },
    Posted: { color: 'bg-green-500 border-green-500 text-white', icon: CheckCircle, label: 'Posted' },
    Error: { color: 'bg-red-500 border-red-500 text-white', icon: AlertTriangle, label: 'Error' },
    'To Do': { color: 'bg-gray-400 border-gray-400 text-white', icon: HelpCircle, label: 'To Do' },
    'Doing': { color: 'bg-blue-500 border-blue-500 text-white', icon: Clock, label: 'Doing' },
    'Preview': { color: 'bg-purple-500 border-purple-500 text-white', icon: Instagram, label: 'Preview' },
    'Revisi': { color: 'bg-orange-500 border-orange-500 text-white', icon: RefreshCcw, label: 'Revisi' },
    'Done': { color: 'bg-green-500 border-green-500 text-white', icon: CheckCircle, label: 'Done' },
};

const StatusIcon = ({ status }: { status: SocialMediaPost['status'] }) => {
    const Icon = statusConfig[status]?.icon || HelpCircle;
    return <Icon className="h-2 w-2" />;
};


export function SocialPostCard({ post, allUsers }: SocialPostCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const statusStyling = statusConfig[post.statusInternal || post.status] || statusConfig['Draft'];
    
  const lastActivityText = React.useMemo(() => {
      if (!post.lastActivity) return null;
      const { user, action, timestamp } = post.lastActivity;
      const timeAgo = timestamp ? formatDistanceToNow(timestamp.toDate ? timestamp.toDate() : new Date(timestamp), { addSuffix: true }) : '';
      return `${user.name} ${action} ${timeAgo}`;
  }, [post.lastActivity]);

  const assignees = React.useMemo(() => {
    return (post.assigneeIds || [])
      .map(id => allUsers.find(u => u.id === id))
      .filter(Boolean) as User[];
  }, [post.assigneeIds, allUsers]);
  
  const PriorityIcon = priorityInfo[post.priority].icon;
  const priorityColor = priorityInfo[post.priority].color;

  const completionStatus = React.useMemo(() => {
    if (post.status !== 'Posted' || !post.postedAt || !post.scheduledAt) return null;
    const completionDate = parseISO(post.postedAt);
    const dueDate = endOfDay(parseISO(post.scheduledAt));
    if (isAfter(completionDate, dueDate)) {
        return { status: 'Late', duration: formatLateness(dueDate, completionDate) };
    }
    return { status: 'On Time', duration: null };
  }, [post.status, post.postedAt, post.scheduledAt]);


  const handleOpenChange = (open: boolean) => {
    if (open) {
        setIsDialogOpen(true);
    } else {
        setIsDialogOpen(false);
    }
  };


  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        <Card 
          className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer group bg-card"
        >
          <CardContent className="p-4 space-y-3">
             <div className="flex items-start justify-between">
                <p className="font-semibold text-base pr-2 break-words">{post.title}</p>
                 <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                           <PriorityIcon className={cn("h-5 w-5 shrink-0", priorityColor)} />
                      </TooltipTrigger>
                      <TooltipContent>
                          <p>{priorityInfo[post.priority].label}</p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            </div>
             {lastActivityText && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger className="w-full">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground text-left">
                                <History className="h-3 w-3 shrink-0" />
                                <p className="truncate">{lastActivityText}</p>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent align="start">
                            <p>{lastActivityText}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
          </CardContent>
          <CardFooter className="p-3 flex justify-between items-center bg-card border-t">
              <div className="flex items-center -space-x-2">
                {assignees.slice(0, 3).map(assignee => (
                  <TooltipProvider key={assignee.id}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent><p>{assignee.name}</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                {assignees.length > 3 && (
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                          <Avatar className="h-7 w-7 border-2 border-background">
                              <AvatarFallback>+{assignees.length - 3}</AvatarFallback>
                          </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                          {assignees.slice(3).map(a => <p key={a.id}>{a.name}</p>)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
            </div>
            <div className="flex items-center flex-shrink-0 gap-2">
                {completionStatus && (
                    completionStatus.status === 'On Time' ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                </TooltipTrigger>
                                <TooltipContent><p>Posted On Time</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <Badge variant="destructive" className="font-normal gap-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            {completionStatus.duration} late
                        </Badge>
                    )
                )}
                {post.scheduledAt && !completionStatus && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="outline" className="flex items-center gap-1.5 text-xs font-medium">
                                    <UploadCloud className="h-3 w-3" />
                                    <span>{format(parseISO(post.scheduledAt), 'MMM d, p')}</span>
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Publish Date: {format(parseISO(post.scheduledAt), 'PPP p')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <Badge variant="outline" className={cn('flex items-center gap-1.5 text-xs font-medium', statusStyling.color)}>
                    <StatusIcon status={post.statusInternal || post.status} />
                    <span>{statusStyling.label}</span>
                </Badge>
            </div>
          </CardFooter>
        </Card>
      </div>
      {isDialogOpen && (
        <SocialMediaPostDetailsSheet 
            post={post}
            open={isDialogOpen} 
            onOpenChange={handleOpenChange}
        />
      )}
    </>
  );
}
