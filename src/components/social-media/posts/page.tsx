
'use client';
import { SocialMediaDataTable } from '@/components/social-media/social-media-data-table';
import { useI18n } from '@/context/i18n-provider';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { SocialMediaPost, User, Brand, WorkflowStatus } from '@/lib/types';
import { Loader2, Plus, ChevronDown } from 'lucide-react';
import { usePermissions } from '@/context/permissions-provider';
import { AddSocialMediaPostDialog } from '@/components/social-media/add-post-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function SocialMediaPostsPage() {
  const { t } = useI18n();
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();

  const postsQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    let q = query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', companyId));

    if (profile?.role === 'Manager') {
        if (!profile.brandIds || profile.brandIds.length === 0) {
            return query(collection(firestore, 'socialMediaPosts'), where('__name__', '==', 'dummy-id'));
        }
        q = query(q, where('brandId', 'in', profile.brandIds));
    }
    
    return q;
  }, [firestore, companyId, profile]);

  const { data: posts, isLoading: arePostsLoading } = useCollection<SocialMediaPost>(postsQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(useMemo(() => firestore && companyId ? query(collection(firestore, 'users'), where('companyId', '==', companyId)) : null, [firestore, companyId]));
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(useMemo(() => firestore && companyId ? query(collection(firestore, 'brands'), where('companyId', '==', companyId)) : null, [firestore, companyId]));
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(useMemo(() => firestore ? query(collection(firestore, 'socialMediaStatuses'), orderBy('order')) : null, [firestore]));

  const isLoading = arePostsLoading || isProfileLoading || areUsersLoading || areBrandsLoading || areStatusesLoading;
  
  const canCreate = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'Super Admin' || profile.role === 'Manager' || profile.role === 'Employee';
  }, [profile]);


  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Social Media Posts</h2>
            <p className="text-muted-foreground">
              Manage all your social media content in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <AddSocialMediaPostDialog>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </AddSocialMediaPostDialog>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SocialMediaDataTable 
            posts={posts || []}
            users={users || []}
            brands={brands || []}
          />
        )}
      </main>
    </div>
  );
}
