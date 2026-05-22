"use client";

import { UnsavedGuard } from "@/components/UnsavedGuard";

export function AccountSettingsUnsavedGuard({
  resetKey,
  children,
}: {
  resetKey: string;
  children: React.ReactNode;
}) {
  return (
    <UnsavedGuard rootId="account-settings-page" resetKey={resetKey}>
      {children}
    </UnsavedGuard>
  );
}
