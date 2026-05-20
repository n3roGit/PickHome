"use client";

import { useId, useState } from "react";

export function CommuteTransitConnection({
  summary,
  detailLines,
}: {
  summary: string;
  detailLines: string[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (detailLines.length === 0) {
    return <p className="text-sm mt-1 text-pn-text-secondary">{summary}</p>;
  }

  return (
    <div className="mt-1">
      <p className="text-sm text-pn-text-secondary">
        {summary}{" "}
        <button
          type="button"
          className="text-pn-accent hover:underline"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          (Details)
        </button>
      </p>
      {open ? (
        <ul
          id={panelId}
          className="text-sm text-pn-text-secondary mt-2 space-y-1 list-none"
        >
          {detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
