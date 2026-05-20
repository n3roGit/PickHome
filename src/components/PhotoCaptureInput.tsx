"use client";

import { useRef } from "react";

type Props = {
  disabled?: boolean;
  maxBytes?: number;
  onTooLarge?: (fileName: string) => void;
  onFiles: (files: File[]) => void;
};

export function PhotoCaptureInput({ disabled, maxBytes, onTooLarge, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(files: FileList | null) {
    if (!files?.length || disabled) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (file.size === 0) continue;
      if (maxBytes != null && file.size > maxBytes) {
        onTooLarge?.(file.name);
        continue;
      }
      accepted.push(file);
    }
    if (inputRef.current) inputRef.current.value = "";
    if (accepted.length > 0) onFiles(accepted);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        disabled={disabled}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => handleChange(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 bg-pn-accent text-white font-semibold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 min-h-[44px]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 shrink-0"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 9a2 2 0 0 1 2-2h2l1-2h10l1 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
        Kamera
      </button>
    </>
  );
}
