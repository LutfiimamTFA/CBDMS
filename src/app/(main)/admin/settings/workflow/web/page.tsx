'use client';

import React from 'react';
import { WorkflowSettings } from '@/components/admin/workflow-settings';

export default function WebWorkflowPage() {
  return <WorkflowSettings collectionName="webStatuses" workstreamTitle="Web" />;
}
