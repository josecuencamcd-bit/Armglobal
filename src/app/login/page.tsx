"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type Paso = "correo" | "entrar" | "solicitar" | "pendiente" | "codigo";

/**
 * Reemplaza la pantalla única progresiva de Code.gs (lgPasoA: correo →
 * entrar | crear | solicitar | codigo). "crear" no existe acá — ver nota en
 * /api/auth/correo. El recuperar-clave también quedó en esta misma pantalla,
 * como en la app vieja (código de 6 dígitos escrito a mano, no un link).
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [paso, setPaso] = useState<Paso>(searchParams.get("bloqueado") === "1" ? "pendiente" : "correo");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveNueva2, setClaveNueva2] = useState("");
  const [nota, setNota] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(
    searchParams.get("bloqueado") === "1" ? "Tu acceso está pendiente de aprobación." : null
  );

  function volver() {
    setError(null);
    setMensaje(null);
    setClave("");
    setCodigo("");
    setClaveNueva("");
    setClaveNueva2("");
    setPaso("correo");
  }

  async function paso1Correo(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const res = await fetch("/api/auth/correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo }),
    });
    const json = await res.json();
    setCargando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    if (json.data.estado === "pendiente") {
      setMensaje("Tu acceso está pendiente de aprobación. Te avisaremos por correo.");
      setPaso("pendiente");
      return;
    }
    setPaso(json.data.estado); // "entrar" | "solicitar"
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    setCargando(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Clave incorrecta." : error.message);
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  async function pedirCodigo() {
    setCargando(true);
    setError(null);
    await fetch("/api/auth/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo }),
    });
    setCargando(false);
    setMensaje(`Te enviamos un código a ${correo}. Vence en 15 minutos.`);
    setPaso("codigo");
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (claveNueva !== claveNueva2) {
      setError("Las claves no coinciden.");
      return;
    }
    setCargando(true);
    const res = await fetch("/api/auth/codigo/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, codigo, clave: claveNueva }),
    });
    const json = await res.json();
    if (!json.ok) {
      setCargando(false);
      setError(json.error);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: claveNueva });
    setCargando(false);
    if (error) {
      setMensaje("Clave actualizada. Entra con tu clave nueva.");
      setPaso("entrar");
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const res = await fetch("/api/solicitudes-acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, nombre, nota, clave: claveNueva }),
    });
    const json = await res.json();
    setCargando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setMensaje("Listo, pedimos tu acceso. Te avisaremos por correo cuando esté aprobado — entra con la clave que elegiste.");
    setPaso("pendiente");
  }

  return (
    <div className="contenedor" style={{ paddingTop: 48 }}>
      <div className="tarjeta" style={{ textAlign: "center", padding: "24px 20px", marginBottom: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cumple/lw.png" alt="armglobal" style={{ height: 28, margin: "0 auto 14px" }} />
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--accent)" }}>
          La <em style={{ fontStyle: "italic" }}>Iglesia</em> es mucho más de lo que te dijeron
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.82rem" }}>
          Campus Punta Arenas · Campus Puerto Natales
        </p>
      </div>

      {paso === "correo" && (
        <form className="tarjeta" onSubmit={paso1Correo}>
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
            {cargando ? "Un momento…" : "Continuar"}
          </button>
        </form>
      )}

      {paso === "entrar" && (
        <form className="tarjeta" onSubmit={entrar}>
          <p className="muted" style={{ margin: "0 0 10px" }}>{correo}</p>
          <div className="campo">
            <label htmlFor="clave">Clave</label>
            <input
              id="clave"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          {mensaje && <p className="ok">{mensaje}</p>}
          {error && <p className="aviso">{error}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? "Entrando…" : "Entrar"}
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); pedirCodigo(); }} style={{ color: "var(--accent)" }}>
              ¿Olvidaste tu clave?
            </a>
          </p>
          <p className="muted" style={{ textAlign: "center" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver(); }} style={{ color: "var(--accent)" }}>
              Usar otro correo
            </a>
          </p>
        </form>
      )}

      {paso === "codigo" && (
        <form className="tarjeta" onSubmit={verificarCodigo}>
          <p className="muted" style={{ margin: "0 0 10px" }}>{correo}</p>
          {mensaje && <p className="ok">{mensaje}</p>}
          <div className="campo">
            <label htmlFor="codigo">Código de 6 dígitos</label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="campo">
            <label htmlFor="claveNueva">Clave nueva</label>
            <input
              id="claveNueva"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="claveNueva2">Repite la clave</label>
            <input
              id="claveNueva2"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={claveNueva2}
              onChange={(e) => setClaveNueva2(e.target.value)}
            />
          </div>
          {error && <p className="aviso">{error}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? "Guardando…" : "Cambiar clave y entrar"}
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); pedirCodigo(); }} style={{ color: "var(--accent)" }}>
              Reenviar código
            </a>
          </p>
          <p className="muted" style={{ textAlign: "center" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver(); }} style={{ color: "var(--accent)" }}>
              Usar otro correo
            </a>
          </p>
        </form>
      )}

      {paso === "solicitar" && (
        <form className="tarjeta" onSubmit={solicitar}>
          <p className="muted" style={{ margin: "0 0 10px" }}>{correo}</p>
          <p style={{ margin: "0 0 14px", fontSize: "0.88rem" }}>No tienes cuenta todavía. Pide acceso:</p>
          <div className="campo">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="claveNueva">Elige una clave</label>
            <input
              id="claveNueva"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="nota">¿Algo que quieras contarnos? (opcional)</label>
            <textarea id="nota" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          {error && <p className="aviso">{error}</p>}
          <button className="boton" type="submit" disabled={cargando}>
            {cargando ? "Enviando…" : "Pedir acceso"}
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver(); }} style={{ color: "var(--accent)" }}>
              Usar otro correo
            </a>
          </p>
        </form>
      )}

      {paso === "pendiente" && (
        <div className="tarjeta">
          <p className="ok">{mensaje}</p>
          <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver(); }} style={{ color: "var(--accent)" }}>
              Volver a entrar
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
