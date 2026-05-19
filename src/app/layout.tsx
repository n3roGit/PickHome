import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PickHome",
  description: "Immobilien bewerten und vergleichen",
  icons: { icon: "/pickhome-logo.png", apple: "/pickhome-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
