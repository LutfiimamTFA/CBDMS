'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

// This page now acts as a simple redirect to the new social media posts list view by default.
export default function SocialMediaPage() {
  const router = useRouter();
  
  React.useEffect(() => {
    router.replace('/social-media/posts');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p>Redirecting to social media posts...</p>
    </div>
  );
}