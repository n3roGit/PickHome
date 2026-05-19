"use client";

import { useTransition } from "react";
import {
  deleteApartmentDocumentAction,
  uploadApartmentDocumentAction,
} from "@/app/actions";
import { FileDropzone } from "@/components/FileDropzone";

type Doc = { id: string; fileName: string; url: string };

export function ApartmentDocuments({
  apartmentId,
  documents,
}: {
  apartmentId: string;
  documents: Doc[];
}) {
  const [pending, startTransition] = useTransition();

  function onUpload(formData: FormData) {
    startTransition(async () => {
      await uploadApartmentDocumentAction(apartmentId, formData);
    });
  }

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-3">Exposé & Dokumente</h2>
      {documents.length > 0 && (
        <ul className="space-y-2 mb-4">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 bg-pn-bg-surface border border-pn-border rounded-lg px-4 py-2"
            >
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-pn-accent hover:underline truncate"
              >
                {d.fileName}
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteApartmentDocumentAction(d.id))}
                className="text-xs text-pn-score-low hover:underline shrink-0"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      <FileDropzone
        name="document"
        accept="application/pdf,.pdf"
        hint="PDF, max. 30 MB"
        disabled={pending}
        onFiles={onUpload}
      />
    </section>
  );
}
