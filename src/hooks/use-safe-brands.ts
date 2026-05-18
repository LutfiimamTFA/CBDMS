
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUserProfile } from '@/firebase';
import type { Brand } from '@/lib/types';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface UseSafeBrandsResult {
  brands: Brand[];
  brandMap: Map<string, string>;
  isLoading: boolean;
}

/**
 * A hook to fetch brands safely, without crashing if the user lacks 'list' permissions.
 * It's designed for roles like 'Employee' who might not have broad access.
 *
 * @returns An object containing the list of brands, a map for quick lookups, and a loading state.
 */
export function useSafeBrands(): UseSafeBrandsResult {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !profile) {
      setIsLoading(false);
      return;
    }

    const fetchBrands = async () => {
      setIsLoading(true);
      try {
        let brandsQuery;
        if (profile.role === 'Super Admin') {
            brandsQuery = query(collection(firestore, 'brands'), orderBy('name'));
        } else if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
            brandsQuery = query(collection(firestore, 'brands'), where('__name__', 'in', profile.brandIds), orderBy('name'));
        } else {
            // For Employees or other roles, attempt to fetch all. This will gracefully fail if permissions are missing.
            brandsQuery = query(collection(firestore, 'brands'));
        }
        
        const snapshot = await getDocs(brandsQuery);
        const fetchedBrands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));
        setBrands(fetchedBrands);

      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.warn('Permission denied to list brands. This is expected for some roles. UI will adapt.');
          setBrands([]); // Return empty array on permission error
        } else {
          console.error("Error fetching brands:", error);
          setBrands([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrands();
  }, [firestore, profile]);

  const brandMap = useMemo(() => {
    const map = new Map<string, string>();
    brands.forEach(brand => map.set(brand.id, brand.name));
    return map;
  }, [brands]);

  return { brands, brandMap, isLoading };
}
