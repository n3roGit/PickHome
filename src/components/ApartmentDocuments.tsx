"use client";

import { useCallback, useState, useTransition } from "react";
import {
  deleteApartmentDocumentAction,
  uploadApartmentDocumentAction,
} from "@/app/actions";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
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

  const uploadFiles = useCallback(
    (files: File[]) => {
      startTransition(async () => {
        setUploadError(null);
        for (const file of files) {
          if (file.size === 0) continue;
          if (file.size > MAX_DOCUMENT_BYTES) {
            setUploadError(apartmentDocumentUploadErrorMessage("too_large", file.name));
            continue;
          }
          const single = new FormData();
          single.set("document", file);
          const result = await uploadApartmentDocumentAction(apartmentId, single);
          if (result && !result.ok) {
            setUploadError(apartmentDocumentUploadErrorMessage(result.error, file.name));
          }
        }
      });
    },
    [apartmentId]
  );

  function onUpload(formData: FormData) {
    const files = formData
      .getAll("document")
      .filter((entry): entry is File => entry instanceof File);
    uploadFiles(files);
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
              <ConfirmActionButton
                confirmMessage={`„${d.fileName}" wirklich entfernen?`}
                action={() => deleteApartmentDocumentAction(d.id)}
                disabled={pending}
                className="text-xs text-pn-score-low hover:underline shrink-0 disabled:opacity-50"
                pendingLabel="…"
              >
                Entfernen
              </ConfirmActionButton>
            </li>
          ))}
        </ul>
      )}
      {uploadError && (
        <p className="mb-3 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {uploadError}
        </p>
      )}
      {pending && (
        <p className="mb-3 text-sm text-pn-text-secondary">Dokumente werden hochgeladen…</p>
      )}
      <FileDropzone
        name="document"
        accept="application/pdf,.pdf"
        hint={`PDF, mehrere Dateien möglich, max. ${MAX_DOCUMENT_MB} MB je Datei`}
        multiple
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
