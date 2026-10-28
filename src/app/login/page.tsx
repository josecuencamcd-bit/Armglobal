"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/** Reemplaza api_login de Code.gs (correo+clave con hash propio) por
 * supabase.auth.signInWithPassword — Supabase Auth hace el resto
 * (hash seguro, tokens, expiración). */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    setCargando(false);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Correo o clave incorrectos." : error.message);
      return;
    }
    router.replace("/encuentros");
    router.refresh();
  }

  return (
    <div className="contenedor" style={{ paddingTop: 64 }}>
      <h1 className="titulo" style={{ fontSize: "1.4rem", textAlign: "center" }}>
        armglobal
      </h1>
      <form className="tarjeta" onSubmit={entrar}>
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
        <div className="campo">
          <label htmlFor="clave">Clave</label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        {error && <p className="aviso">{error}</p>}
        <button className="boton" type="submit" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="muted" style={{ textAlign: "center" }}>
        <a href="/recuperar" style={{ color: "var(--accent)" }}>
          ¿Olvidaste tu clave?
        </a>
      </p>
      <p className="muted" style={{ textAlign: "center" }}>
        ¿No tienes cuenta?{" "}
        <a href="/solicitar-acceso" style={{ color: "var(--accent)" }}>
          Pide acceso
        </a>
      </p>
    </div>
  );
}
