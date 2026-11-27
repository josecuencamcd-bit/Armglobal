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
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const SW_REGISTER = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

// Por defecto la app es oscura; si la persona eligió "claro" en Mi perfil
// queda guardado en localStorage. Esto corre ANTES de pintar la página
// (bloqueante, en <head>) para que no se vea un parpadeo oscuro→claro.
const THEME_INIT = `
try {
  if (localStorage.getItem('arm-tema') === 'claro') {
    document.documentElement.setAttribute('data-tema', 'claro');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      </body>
    </html>
  );
}
