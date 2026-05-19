/** Max stored text per PDF (search index; keeps SQLite rows reasonable). */
export const MAX_EXTRACTED_PDF_TEXT_LENGTH = 200_000;

export function normalizeExtractedPdfText(raw: string): string {
  return raw
    .replace(/\0/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EXTRACTED_PDF_TEXT_LENGTH);
}

export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  if (buffer.length === 0) return null;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = normalizeExtractedPdfText(result.text ?? "");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
