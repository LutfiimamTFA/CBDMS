
'use client';

import type { SocialMediaPost, User } from './types';

/**
 * Normalizes a SocialMediaPost object to ensure backward compatibility and provide default values.
 * This ensures that both old and new data structures can be handled gracefully by the UI.
 *
 * @param post The raw SocialMediaPost object from Firestore.
 * @param currentUserProfile The profile of the currently logged-in user.
 * @returns A normalized SocialMediaPost object with all required fields present.
 */
export function normalizeSocialPost(post: SocialMediaPost, currentUserProfile: User): SocialMediaPost {
  // Title: Fallback to the first 50 chars of the caption if title is missing.
  const title = post.title || post.caption?.slice(0, 50) || 'Untitled Post';

  // Due Date: Prioritize the new `dueDate` field, but fall back to the legacy `scheduledAt`.
  const dueDate = post.dueDate || post.scheduledAt || undefined;

  // Priority: Default to 'Medium' if not set.
  const priority = post.priority || 'Medium';

  // Status: Prioritize `status` over the legacy `statusInternal`. Default to 'To Do'.
  const status = post.status || post.statusInternal || 'To Do';

  // Assignees: Default to the creator if no assignees are set.
  const assigneeIds = post.assigneeIds && post.assigneeIds.length > 0
    ? post.assigneeIds
    : (post.createdBy ? [post.createdBy.id] : [currentUserProfile.id]);

  // Dependencies: Default to an empty array.
  const dependencies = post.dependencies || [];

  return {
    ...post,
    title,
    dueDate,
    priority,
    status,
    assigneeIds,
    dependencies,
  };
}
