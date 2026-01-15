
'use client';
import { SchedulePage } from '@/components/schedule/schedule-page';

export default function SocialMediaSchedulePage() {
  // Now explicitly tells the generic schedule page to use 'socialMediaPosts'
  // which will correctly handle dueDate and status logic.
  return <SchedulePage workstream="socialMediaPosts" />;
}
