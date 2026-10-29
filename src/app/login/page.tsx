"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/** Reemplaza api_login de Code.gs (correo+clave con hash propio) por
 * supabase.auth.signInWithPassword — Supabase Auth hace el resto
 * (hash seguro, tokens, expiración). */
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
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("bloqueado") === "1" ? "Tu acceso está pendiente de aprobación." : null
  );
  const [redirigiendo, setRedirigiendo] = useState(false);

  useEffect(() => {
    // Supabase recorta el redirectTo del correo de recuperación a la raíz
    // del dominio (ignora la ruta /actualizar-clave), así que el link llega
    // acá con la sesión de recuperación en el hash (#access_token=...&
    // type=recovery). La reenviamos a donde sí se procesa, conservando el
    // hash para que Supabase la detecte ahí.
    if (window.location.hash.includes("type=recovery")) {
      setRedirigiendo(true);
      router.replace(`/actualizar-clave${window.location.hash}`);
    }
  }, [router]);

  if (redirigiendo) return null;

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
    router.replace("/inicio");
    router.refresh();
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
