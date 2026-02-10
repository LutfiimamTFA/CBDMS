'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { Loader2, Filter, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import { query, collection, where } from 'firebase/firestore';
import type { WebArticle, User, Brand } from '@/lib/types';
import { useSafeBrands } from '@/hooks/use-safe-brands';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';

export default function WebBoardPage() {
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const firestore = useFirestore();
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const articlesQuery = useMemo(() => {
    if (!firestore || !companyId || !profile) return null;
    let q = query(collection(firestore, 'webArticles'), where('companyId', '==', companyId));

    if (profile.role === 'Manager') {
      if (!profile.brandIds || profile.brandIds.length === 0) {
        return query(collection(firestore, 'webArticles'), where('__name__', '==', 'dummy-id'));
      }
      q = query(q, where('brandId', 'in', profile.brandIds));
    } else if (profile.role === 'Employee' || profile.role === 'PIC') {
        q = query(q, where('assigneeIds', 'array-contains', profile.id));
    }
    
    return q;
  }, [firestore, companyId, profile]);
  const { data: articles, isLoading: areArticlesLoading } = useCollection<WebArticle>(articlesQuery);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(useMemo(() => firestore && companyId ? query(collection(firestore, 'users'), where('companyId', '==', companyId)) : null, [firestore, companyId]));
  const { brands, isLoading: areBrandsLoading } = useSafeBrands();
  
  const brandOptions = useMemo(() => (brands || []).map(b => ({ value: b.id, label: b.name })), [brands]);
  const userOptions = useMemo(() => {
    if (!allUsers || !profile) return [];
    if (profile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === profile.id);
      const self = allUsers.find(u => u.id === profile.id);
      return (self ? [self, ...team] : team).map(user => ({ value: user.id, label: user.name }));
    }
    return allUsers.filter(u => u.role === 'Employee' || u.role === 'Manager').map(user => ({ value: user.id, label: user.name }));
  }, [allUsers, profile]);

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    let filtered = articles;
    if (profile?.role === 'Super Admin' && selectedBrands.length > 0) {
      filtered = filtered.filter(article => article.brandId && selectedBrands.includes(article.brandId));
    } else if (profile?.role === 'Manager' && selectedUsers.length > 0) {
      filtered = filtered.filter(article => article.assigneeIds.some(assigneeId => selectedUsers.includes(assigneeId)));
    }
    return filtered;
  }, [articles, selectedUsers, selectedBrands, profile]);

  const resetFilters = () => {
    setSelectedUsers([]);
    setSelectedBrands([]);
  };

  const isLoading = isProfileLoading || areArticlesLoading || areUsersLoading || areBrandsLoading;
  const isSuperAdmin = profile?.role === 'Super Admin';
  const isManager = profile?.role === 'Manager';

  if (!isLoading && (!profile || profile.role === 'Client')) {
      notFound();
  }
  
  return (
    <div className="flex h-full flex-col">
        <div className="p-4 md:p-6 mb-4 space-y-4">
            {isSuperAdmin && (
              <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <Filter className="mr-2 h-4 w-4" /> Filter by Brand
                    {selectedBrands.length > 0 && <Badge variant="secondary" className="ml-2">{selectedBrands.length}</Badge>}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='p-4 border rounded-lg bg-card'>
                   <div className='flex flex-col lg:flex-row gap-4 items-start'>
                      <div className='flex-1 w-full space-y-2'>
                         <Label htmlFor='brand-filter'>Brands</Label>
                         <MultiSelect id="brand-filter" options={brandOptions} onValueChange={setSelectedBrands} defaultValue={selectedBrands} placeholder="Select brands..." />
                      </div>
                      {selectedBrands.length > 0 && (<Button variant="ghost" size="sm" onClick={resetFilters} className="mt-auto"><X className="mr-2 h-4 w-4"/>Reset</Button>)}
                   </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            {isManager && (
              <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen} className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <Filter className="mr-2 h-4 w-4" /> Filter by Assignee
                    {selectedUsers.length > 0 && <Badge variant="secondary" className="ml-2">{selectedUsers.length}</Badge>}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='p-4 border rounded-lg bg-card'>
                   <div className='flex flex-col lg:flex-row gap-4 items-start'>
                      <div className='flex-1 w-full space-y-2'>
                         <Label htmlFor='assignee-filter'>Assignees</Label>
                         <MultiSelect id="assignee-filter" options={userOptions} onValueChange={setSelectedUsers} defaultValue={selectedUsers} placeholder="Select employees..." />
                      </div>
                      {selectedUsers.length > 0 && (<Button variant="ghost" size="sm" onClick={resetFilters} className="mt-auto"><X className="mr-2 h-4 w-4"/>Reset</Button>)}
                   </div>
                </CollapsibleContent>
              </Collapsible>
            )}
        </div>
        <GenericKanbanBoard
            items={filteredArticles}
            users={allUsers || []}
            isLoading={isLoading}
            itemType="webArticles"
            statusCollection="webStatuses"
        />
    </div>
  );
}
