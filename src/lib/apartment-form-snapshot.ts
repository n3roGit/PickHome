/** Stable snapshot of editable fields in a form (ignores revision hidden input). */

export function snapshotForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  const elements = form.querySelectorAll("input, textarea, select");

  for (const el of elements) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name || el.name === "revision") continue;

    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      parts.push(`${el.name}=${el.checked ? "1" : "0"}`);
    } else if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
      if (el.checked) parts.push(`${el.name}=${el.value}`);
    } else {
      parts.push(`${el.name}=${el.value}`);
    }
  }

  parts.sort();
  return parts.join("\n");
}

export function formHasChanges(form: HTMLFormElement, baseline: string): boolean {
  return snapshotForm(form) !== baseline;
}
