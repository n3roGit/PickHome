"use client";

import { UnsavedGuard } from "@/components/UnsavedGuard";

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
    <UnsavedGuard rootId={`project-page-${projectId}`} resetKey={resetKey}>
      {children}
    </UnsavedGuard>
  );
}
