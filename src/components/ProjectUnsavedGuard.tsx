"use client";

import { UnsavedGuard } from "@/components/UnsavedGuard";
import { CRITERIA_NAMES_SAVED_EVENT } from "@/lib/criteria-editor-events";

export function ProjectUnsavedGuard({
  projectId,
  resetKey,
  children,
}: {
  projectId: string;
  resetKey: string;
  children: React.ReactNode;
}) {
  return (
    <UnsavedGuard
      rootId={`project-page-${projectId}`}
      resetKey={resetKey}
      rescanEvents={[CRITERIA_NAMES_SAVED_EVENT]}
    >
      {children}
    </UnsavedGuard>
  );
}
