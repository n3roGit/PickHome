"use client";

import { deleteUserAddressAction } from "@/app/actions";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";

export function DeleteUserAddressButton({
  addressId,
  label,
}: {
  addressId: string;
  label: string;
}) {
  return (
    <ConfirmActionButton
      confirmMessage={`Adresse „${label}" wirklich löschen?`}
      action={() => deleteUserAddressAction(addressId)}
      className="text-sm text-pn-score-low hover:underline disabled:opacity-50"
      pendingLabel="Löscht…"
    >
      Löschen
    </ConfirmActionButton>
  );
}
