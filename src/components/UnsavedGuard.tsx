"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formHasChanges, snapshotForm } from "@/lib/apartment-form-snapshot";
import { UNSAVED_SECTION_CLASS } from "@/lib/unsaved-guard";

type TrackedForm = {
  form: HTMLFormElement;
  label: string;
  baseline: string;
};

function collectTrackedForms(root: HTMLElement): TrackedForm[] {
  const nodes = root.querySelectorAll<HTMLFormElement>("form[data-unsaved-track]");
  const out: TrackedForm[] = [];
  for (const form of nodes) {
    const label = form.dataset.unsavedLabel?.trim();
    if (!label) continue;
    out.push({ form, label, baseline: snapshotForm(form) });
  }
  return out;
}

function isInternalNavigation(href: string, currentPath: string, currentSearch: string): boolean {
  if (href.startsWith("#")) return false;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    return url.pathname !== currentPath || url.search !== currentSearch;
  } catch {
    return false;
  }
}

export function UnsavedGuard({
  rootId,
  resetKey = "",
  rescanEvents = [],
  children,
}: {
  /** Element id wrapping all tracked forms (e.g. apartment-page-…). */
  rootId: string;
  /** Change when a server action saved a section (e.g. query flags). */
  resetKey?: string;
  /** Custom window events that should trigger a baseline rescan. */
  rescanEvents?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [tracked, setTracked] = useState<TrackedForm[]>([]);
  const [dirtyLabels, setDirtyLabels] = useState<string[]>([]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const rescan = useCallback(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    setTracked(collectTrackedForms(root));
    setDirtyLabels([]);
    root.querySelectorAll(`.${UNSAVED_SECTION_CLASS}`).forEach((el) => {
      el.classList.remove(UNSAVED_SECTION_CLASS);
    });
  }, [rootId]);

  useEffect(() => {
    rescan();
  }, [resetKey, rescan]);

  useEffect(() => {
    if (rescanEvents.length === 0) return;
    const handler = () => rescan();
    for (const eventName of rescanEvents) {
      window.addEventListener(eventName, handler);
    }
    return () => {
      for (const eventName of rescanEvents) {
        window.removeEventListener(eventName, handler);
      }
    };
  }, [rescanEvents, rescan]);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const obs = new MutationObserver(() => {
      const count = root.querySelectorAll("form[data-unsaved-track]").length;
      if (count > 0 && count !== tracked.length) rescan();
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [rootId, resetKey, rescan, tracked.length]);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || tracked.length === 0) return;

    const updateDirty = () => {
      const labels: string[] = [];
      for (const { form, label, baseline } of tracked) {
        const highlight = form.closest("section") ?? form.closest("li") ?? form;
        if (formHasChanges(form, baseline)) {
          labels.push(label);
          highlight.classList.add(UNSAVED_SECTION_CLASS);
        } else {
          highlight.classList.remove(UNSAVED_SECTION_CLASS);
        }
      }
      setDirtyLabels(labels);
    };

    updateDirty();
    root.addEventListener("input", updateDirty);
    root.addEventListener("change", updateDirty);
    return () => {
      root.removeEventListener("input", updateDirty);
      root.removeEventListener("change", updateDirty);
    };
  }, [rootId, tracked]);

  const dirty = dirtyLabels.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        !isInternalNavigation(href, window.location.pathname, window.location.search)
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const dialogOpen = pendingHref != null && dirty;

  const leave = useCallback(() => {
    if (!pendingHref) return;
    const href = pendingHref;
    setPendingHref(null);
    router.push(href);
  }, [pendingHref, router]);

  const stay = useCallback(() => {
    setPendingHref(null);
  }, []);

  const dirtyList = useMemo(
    () =>
      dirtyLabels.map((label) => (
        <li key={label}>{label}</li>
      )),
    [dirtyLabels]
  );

  return (
    <>
      {children}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-leave-title"
        >
          <div className="bg-pn-bg-surface border border-pn-border rounded-xl shadow-lg max-w-md w-full p-5">
            <h2 id="unsaved-leave-title" className="font-semibold text-lg mb-2">
              Ungespeicherte Änderungen
            </h2>
            <p className="text-sm text-pn-text-secondary mb-3">
              Folgende Bereiche wurden geändert, aber noch nicht mit „Speichern“ übernommen:
            </p>
            <ul className="text-sm list-disc list-inside mb-4 space-y-1 text-pn-text-primary">
              {dirtyList}
            </ul>
            <p className="text-xs text-pn-text-tertiary mb-4">
              Markierte Bereiche sind am Rand hervorgehoben.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={stay}
                className="px-4 py-2 rounded-lg border border-pn-border text-sm font-medium hover:bg-pn-bg-subtle"
              >
                Auf der Seite bleiben
              </button>
              <button
                type="button"
                onClick={leave}
                className="px-4 py-2 rounded-lg bg-pn-accent text-white text-sm font-semibold hover:opacity-90"
              >
                Verwerfen und verlassen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
