"use client";

import { useState, useTransition } from "react";
import {
  deleteApartmentDocumentAction,
  uploadApartmentDocumentAction,
} from "@/app/actions";
import { FileDropzone } from "@/components/FileDropzone";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MB } from "@/lib/upload-limits";
import { apartmentDocumentUploadErrorMessage } from "@/lib/upload-messages";

type Doc = { id: string; fileName: string; url: string };

export function ApartmentDocuments({
  apartmentId,
  documents,
}: {
  apartmentId: string;
  documents: Doc[];
}) {
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onUpload(formData: FormData) {
    startTransition(async () => {
      setUploadError(null);
      const file = formData.get("document");
      if (!(file instanceof File) || file.size === 0) return;
      if (file.size > MAX_DOCUMENT_BYTES) {
        setUploadError(apartmentDocumentUploadErrorMessage("too_large", file.name));
        return;
      }
      const result = await uploadApartmentDocumentAction(apartmentId, formData);
      if (result && !result.ok) {
        setUploadError(apartmentDocumentUploadErrorMessage(result.error, file.name));
      }
    });
  }

  return (
    <CollapsibleSection
      title="Exposé & Dokumente"
      defaultOpen
      headerAside={documents.length > 0 ? `${documents.length} Dateien` : undefined}
    >
      {documents.length > 0 && (
        <ul className="space-y-2 mb-4">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 bg-pn-bg-subtle border border-pn-border rounded-lg px-4 py-2"
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
      {uploadError && (
        <p className="mb-3 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {uploadError}
        </p>
      )}
      <FileDropzone
        name="document"
        accept="application/pdf,.pdf"
        hint={`PDF, max. ${MAX_DOCUMENT_MB} MB`}
        disabled={pending}
        maxBytes={MAX_DOCUMENT_BYTES}
        onTooLarge={(fileName) =>
          setUploadError(apartmentDocumentUploadErrorMessage("too_large", fileName))
        }
        onFiles={onUpload}
      />
    </CollapsibleSection>
  );
}
