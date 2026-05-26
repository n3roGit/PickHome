import type { ApartmentPdfData, ApartmentPdfVariant } from "@/lib/apartment-pdf-data";
import { createApartmentPdfDocument } from "@/lib/apartment-pdf-creator";

export type { ApartmentPdfVariant };

export async function renderApartmentPdfBuffer(
  data: ApartmentPdfData,
  options: { variant?: ApartmentPdfVariant } = {}
): Promise<Buffer> {
  const reactModule = await import(/* webpackIgnore: true */ "react");
  const React = ("default" in reactModule ? reactModule.default : reactModule) as typeof import("react");
  const pdf = await import(/* webpackIgnore: true */ "@react-pdf/renderer");
  const document = createApartmentPdfDocument(React, pdf, data, options);
  return pdf.renderToBuffer(document);
}
