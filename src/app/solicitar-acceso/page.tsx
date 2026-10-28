"use client";

import { useState } from "react";

/** Reemplaza api_solicitarAcceso: cualquiera sin cuenta pide entrar, un
 * Admin app la aprueba desde /api/solicitudes-acceso. */
export default function SolicitarAccesoPage() {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const res = await fetch("/api/solicitudes-acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, nombre, nota }),
    });
    const json = await res.json();
    setCargando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="contenedor" style={{ paddingTop: 64 }}>
        <div className="tarjeta">
          <p className="ok">Listo, pedimos tu acceso. Te avisaremos cuando esté aprobado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 64 }}>
      <h1 className="titulo" style={{ fontSize: "1.4rem", textAlign: "center" }}>
        Pedir acceso
      </h1>
      <form className="tarjeta" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="nota">¿Algo que quieras contarnos? (opcional)</label>
          <textarea id="nota" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        {error && <p className="aviso">{error}</p>}
        <button className="boton" type="submit" disabled={cargando}>
          {cargando ? "Enviando…" : "Pedir acceso"}
        </button>
      </form>
    </div>
  );
}
