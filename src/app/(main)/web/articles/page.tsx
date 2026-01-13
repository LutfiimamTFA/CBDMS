'use client';
import { useI18n } from '@/context/i18n-provider';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { WebArticle, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2, Plus } from 'lucide-react';
import { usePermissions } from '@/context/permissions-provider';
import { Button } from '@/components/ui/button';
import { WebArticlesDataTable } from '@/components/web/web-articles-data-table';
import { AddWebArticleDialog } from '@/components/web/add-web-article-dialog';


export default function WebArticlesPage() {
  const { t } = useI18n();
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();

  const articlesQuery = React.useMemo(() => {
    if (!firestore || !companyId || !profile) return null;

    if (profile.role === 'Manager' && (!profile.brandIds || profile.brandIds.length === 0)) {
        return query(collection(firestore, 'webArticles'), where('__name__', '==', 'dummy-id-to-get-empty-result'));
    }

    let q = query(collection(firestore, 'webArticles'), where('companyId', '==', companyId));

    if (profile.role === 'Manager') {
      q = query(q, where('brandId', 'in', profile.brandIds));
    } else if (profile.role === 'Employee' || profile.role === 'PIC') {
      q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    
    return q;
  }, [firestore, companyId, profile]);

  const usersQuery = React.useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', companyId));
    if (profile.role === 'Manager') {
      q = query(q, where('managerId', '==', profile.id));
    }
    return q;
  }, [firestore, companyId, profile]);

  const brandsQuery = React.useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'brands'), orderBy('name'));
    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', profile.brandIds));
    }
    return q;
  }, [firestore, profile]);
  
  const statusesQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  
  const { data: articles, isLoading: isArticlesLoading } = useCollection<WebArticle>(articlesQuery);
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);


  const isLoading = isArticlesLoading || isProfileLoading || arePermsLoading || areStatusesLoading || areBrandsLoading || isUsersLoading;
  
  const canCreate = useMemo(() => {
    if (arePermsLoading || !profile || !permissions) return false;
    if (profile.role === 'Super Admin') return true;
    if (profile.role === 'Manager') return permissions.Manager.canCreateTasks; // Using task permission as proxy
    if (profile.role === 'Employee') return permissions.Employee.canCreateTasks;
    return false;
  }, [profile, permissions, arePermsLoading]);

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Web Articles</h2>
            <p className="text-muted-foreground">Manage all your web articles and content pieces here.</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <AddWebArticleDialog>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Article
                </Button>
              </AddWebArticleDialog>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <WebArticlesDataTable 
            articles={articles || []}
            statuses={statuses || []}
            brands={brands || []}
            users={users || []}
          />
        )}
      </main>
    </div>
  );
}

    