'use client';

import React from 'react';
import { WorkflowSettings } from '@/components/admin/workflow-settings';

export default function TaskWorkflowPage() {
  return <WorkflowSettings collectionName="statuses" workstreamTitle="Task" />;
}
