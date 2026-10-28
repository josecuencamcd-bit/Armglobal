"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type MiPerfil = { nombre: string; correo: string; telefono: string | null; nacimiento: string | null; foto_url: string | null };

/** Reduce la imagen a un cuadrado chico y la comprime a JPEG hasta que
 * entre en el tope de 45000 caracteres que acepta /api/perfil (mismo
 * límite de Code.gs, que guardaba la foto directo en la celda). */
async function fotoADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const lado = 320;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  const escala = Math.max(lado / bitmap.width, lado / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h);
  for (const calidad of [0.8, 0.6, 0.4, 0.25]) {
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length <= 45_000) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}

/** Mi perfil: datos propios (teléfono, fecha de cumpleaños, correo de
 * acceso) — equivalente a la pantalla "Mi perfil" de la app vieja, contra
 * /api/perfil (GET/PATCH), ya existente. Cambiar roles/campus NO va acá
 * (eso es solo de Admin app, en /perfiles). */
export default function MiPerfilPage() {
  const supabase = createClient();
  const [perfil, setPerfil] = useState<MiPerfil | null>(null);
  const [telefono, setTelefono] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [correoNuevo, setCorreoNuevo] = useState("");
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/perfil");
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setPerfil(json.data);
    setTelefono(json.data.telefono ?? "");
    setNacimiento(json.data.nacimiento ?? "");
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const cambios: Record<string, string> = {};
    if (telefono) cambios.telefono = telefono;
    if (nacimiento) cambios.nacimiento = nacimiento;
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMensaje("Datos guardados.");
    await cargar();
  }

  async function cambiarFoto(file: File | undefined) {
    if (!file) return;
    setSubiendoFoto(true);
    setError(null);
    try {
      const foto_url = await fotoADataUrl(file);
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_url }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setMensaje("Foto actualizada.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function cambiarCorreo() {
    if (!correoNuevo) return;
    setCambiandoCorreo(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ email: correoNuevo });
    setCambiandoCorreo(false);
    if (err) { setError(err.message); return; }
    setMensaje("Te enviamos un correo de confirmación al nuevo correo. Confírmalo para que el cambio quede activo.");
    setCorreoNuevo("");
  }

  if (!perfil && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Mi perfil</h1>
      {error && <p className="aviso">{error}</p>}
      {mensaje && <p className="muted">{mensaje}</p>}

      {perfil && (
        <>
          <div className="tarjeta">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 64, height: 64, borderRadius: "50%", flex: "0 0 auto", overflow: "hidden",
                  background: perfil.foto_url ? undefined : "var(--gold-grad)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent-ink)", fontWeight: 700, fontSize: "1.3rem",
                }}
              >
                {perfil.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfil.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  perfil.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()
                )}
              </div>
              <div>
                <p style={{ fontWeight: 700, margin: 0 }}>{perfil.nombre}</p>
                <p className="muted" style={{ margin: "2px 0 8px", fontSize: "0.85rem" }}>{perfil.correo}</p>
                <label
                  style={{
                    display: "inline-block", fontSize: "0.78rem", color: "var(--accent)", cursor: "pointer",
                    border: "1px solid var(--line)", borderRadius: 999, padding: "4px 10px",
                  }}
                >
                  {subiendoFoto ? "Subiendo…" : "Cambiar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => cambiarFoto(e.target.files?.[0])}
                    disabled={subiendoFoto}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            <div className="campo">
              <label>Teléfono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            <div className="campo">
              <label>Fecha de cumpleaños</label>
              <input type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
            </div>
            <button className="boton" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar mis datos"}
            </button>
          </div>

          <div className="tarjeta">
            <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Correo con el que entro</p>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.8rem" }}>
              Si lo cambias, desde ahora entras con el correo nuevo y tu misma clave.
            </p>
            <div className="campo">
              <input type="email" value={correoNuevo} onChange={(e) => setCorreoNuevo(e.target.value)} placeholder="nuevo@correo.com" />
            </div>
            <button
              style={{ width: "100%", padding: "10px", background: "none", border: "1px solid var(--line)", borderRadius: 10, color: "var(--ink)", cursor: "pointer" }}
              onClick={cambiarCorreo}
              disabled={cambiandoCorreo || !correoNuevo}
            >
              {cambiandoCorreo ? "…" : "Cambiar mi correo de acceso"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
