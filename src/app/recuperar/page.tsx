"use client";

import { useState } from "react";

export const dynamic = "force-dynamic";

/** Reemplaza api_olvide de Code.gs: pide el correo y dispara /api/auth/recuperar
 * (genera el link con el cliente admin y lo manda con marca ARM Global vía
 * Resend, en vez del mailer nativo de Supabase). */
export default function RecuperarPage() {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const res = await fetch("/api/auth/recuperar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo }),
    });
    setCargando(false);
    if (!res.ok) {
      setError("No se pudo enviar el correo. Intenta de nuevo en un momento.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="contenedor" style={{ paddingTop: 64 }}>
        <div className="tarjeta">
          <p className="ok">
            Si ese correo tiene una cuenta, te llegará un link para definir tu clave. Revisa también spam.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 64 }}>
      <h1 className="titulo" style={{ fontSize: "1.4rem", textAlign: "center" }}>
        Recuperar clave
      </h1>
      <form className="tarjeta" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        {error && <p className="aviso">{error}</p>}
        <button className="boton" type="submit" disabled={cargando}>
          {cargando ? "Enviando…" : "Enviar link"}
        </button>
      </form>
      <p className="muted" style={{ textAlign: "center" }}>
        <a href="/login" style={{ color: "var(--accent)" }}>
          Volver a entrar
        </a>
      </p>
    </div>
  );
}
