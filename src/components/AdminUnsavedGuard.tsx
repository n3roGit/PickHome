"use client";

import { UnsavedGuard } from "@/components/UnsavedGuard";

export function AdminUnsavedGuard({
  resetKey,
  children,
}: {
  resetKey: string;
  children: React.ReactNode;
}) {
  return (
    <UnsavedGuard rootId="admin-page" resetKey={resetKey}>
      {children}
    </UnsavedGuard>
  );
}
