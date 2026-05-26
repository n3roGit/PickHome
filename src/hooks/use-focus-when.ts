import { useEffect, useRef, type RefObject } from "react";

type FocusableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

export function useFocusWhen<T extends FocusableElement>(
  active: boolean,
  options: { select?: boolean } = {},
): RefObject<T> {
  const ref = useRef<T>(null);
  const select = options.select ?? false;

  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (select && "select" in el && typeof (el as HTMLInputElement).select === "function") {
        (el as HTMLInputElement).select();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [active, select]);

  return ref;
}
