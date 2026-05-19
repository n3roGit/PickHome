"use client";

import { useCallback, useState } from "react";

type Props = {
  name: string;
  accept: string;
  hint: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (formData: FormData) => void;
};

export function FileDropzone({ name, accept, hint, multiple, disabled, onFiles }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled) return;
      const fd = new FormData();
      for (const file of Array.from(files)) {
        fd.append(name, file);
      }
      onFiles(fd);
    },
    [disabled, name, onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        dragging
          ? "border-pn-accent bg-pn-brand-muted"
          : "border-pn-border bg-pn-bg-subtle"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <p className="text-sm text-pn-text-secondary mb-2">Dateien hierher ziehen oder auswählen</p>
      <p className="text-xs text-pn-text-tertiary mb-3">{hint}</p>
      <input
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        className="text-sm mx-auto block"
      />
    </div>
  );
}
