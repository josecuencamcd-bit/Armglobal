/** Paths SVG (viewBox 0 0 24 24) extraídos 1:1 del objeto `ICONOS` de la app
 * vieja (Code.gs, embedded.html) — mismos íconos, mismo trazo. */
export const ICONOS: Record<string, string> = {
  inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  asistencia: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12.5l3 3 5-6"/>',
  aportes: '<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M16 15h2"/>',
  fondo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>',
  finanzas: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v0M18 15v0"/>',
  equipo: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
  turnos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/><path d="M12 15v-3l2 1.5"/>',
  visitas: '<circle cx="10" cy="8" r="3.4"/><path d="M3 20c0-3.5 3-6.2 7-6.2"/><path d="M18 10v6M15 13h6"/>',
  cumples: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12"/><path d="M3 14h18"/><path d="M12 9c-2.5 0-4-1-4-2.6S9.3 4 10.5 4C12 4 12 6.5 12 9zM12 9c2.5 0 4-1 4-2.6S14.7 4 13.5 4C12 4 12 6.5 12 9z"/>',
  perfiles: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  reuniones: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/><path d="M9 16l2 2 4-4"/>',
  soporte: '<path d="M12 2a7 7 0 0 0-7 7v3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v-7a6 6 0 1 1 12 0v7h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2v-3a7 7 0 0 0-7-7z"/><path d="M8 16v2a4 4 0 0 0 4 4"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  panorama: '<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
  bajas: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11h6"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  actividad: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  administracion: '<rect x="4" y="3" width="7" height="7" rx="1.5"/><rect x="13" y="3" width="7" height="7" rx="1.5"/><rect x="4" y="14" width="7" height="7" rx="1.5"/><rect x="13" y="14" width="7" height="7" rx="1.5"/>',
  volver: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

export function Icono({ id, size = 22 }: { id: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      stroke="currentColor"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONOS[id] || ICONOS.inicio }}
    />
  );
}
