'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page now acts as a simple redirect to the new social media posts list view by default.
export default function SocialMediaListPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/social-media/posts');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p>Redirecting to social media posts...</p>
    </div>
  );
}

    