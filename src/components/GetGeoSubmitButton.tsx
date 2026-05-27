"use client";

import { useFormStatus } from "react-dom";

type ServerAction = (formData: FormData) => void | Promise<void>;

export function GetGeoSubmitButton({ formAction }: { formAction: ServerAction }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className="shrink-0 bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-3 py-2 rounded-lg text-sm hover:bg-pn-border/40 disabled:opacity-60 min-w-[5.5rem]"
      title="Nur diese Adresse per OpenStreetMap auflösen"
      data-testid="apartment-getgeo"
    >
      {pending ? "Geo …" : "GetGeo"}
    </button>
  );
}
