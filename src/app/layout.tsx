import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARM Global",
  description: "Reportes de finanzas y asistencia · ARM Global",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "ARM Global",
  },
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
