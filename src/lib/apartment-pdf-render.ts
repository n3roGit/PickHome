import type { ApartmentPdfData } from "@/lib/apartment-pdf-data";
import { createApartmentPdfDocument } from "@/lib/apartment-pdf-creator";

export async function renderApartmentPdfBuffer(data: ApartmentPdfData): Promise<Buffer> {
  const reactModule = await import(/* webpackIgnore: true */ "react");
  const React = ("default" in reactModule ? reactModule.default : reactModule) as typeof import("react");
  const pdf = await import(/* webpackIgnore: true */ "@react-pdf/renderer");
  const document = createApartmentPdfDocument(React, pdf, data);
  return pdf.renderToBuffer(document);
}
