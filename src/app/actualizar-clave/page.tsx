"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/** Reemplaza api_restablecer de Code.gs. El link del correo trae
 * ?token_hash=...&type=recovery (lo armamos nosotros en /api/auth/recuperar,
 * sin pasar por el redirect de Supabase — ver el comentario de esa ruta);
 * acá lo canjeamos directo con verifyOtp para abrir la sesión temporal, y
 * updateUser fija la clave nueva. También sirve para que cualquier usuario
 * logueado cambie su clave (en ese caso ya hay sesión y no hace falta
 * token_hash). */
export default function ActualizarClavePage() {
  return (
    <Suspense>
      <ActualizarClaveForm />
    </Suspense>
  );
}

function ActualizarClaveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const tokenHash = searchParams.get("token_hash");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!cancelado && !error) setListo(true);
        return;
      }
      // Sin token_hash en la URL: puede ser un usuario ya logueado que
      // simplemente quiere cambiar su clave.
      const { data } = await supabase.auth.getSession();
      if (!cancelado && data.session) setListo(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase, searchParams]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (clave.length < 4 || clave.length > 40) {
      setError("La clave debe tener entre 4 y 40 caracteres.");
      return;
    }
    if (clave !== clave2) {
      setError("Las claves no coinciden.");
      return;
    }
    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOk(true);
    setTimeout(() => {
      router.replace("/encuentros");
      router.refresh();
    }, 1500);
  }

  if (ok) {
    return (
      <div className="contenedor" style={{ paddingTop: 64 }}>
        <div className="tarjeta">
          <p className="ok">Clave actualizada. Entrando…</p>
        </div>
      </div>
    );
  }

  if (!listo) {
    return (
      <div className="contenedor" style={{ paddingTop: 64 }}>
        <div className="tarjeta">
          <p className="aviso">
            Este link ya no es válido o expiró. Pide uno nuevo desde{" "}
            <a href="/recuperar" style={{ color: "var(--accent)" }}>
              Recuperar clave
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 64 }}>
      <h1 className="titulo" style={{ fontSize: "1.4rem", textAlign: "center" }}>
        Nueva clave
      </h1>
      <form className="tarjeta" onSubmit={guardar}>
        <div className="campo">
          <label htmlFor="clave">Clave nueva</label>
          <input
            id="clave"
            type="password"
            autoComplete="new-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="clave2">Repite la clave</label>
          <input
            id="clave2"
            type="password"
            autoComplete="new-password"
            required
            value={clave2}
            onChange={(e) => setClave2(e.target.value)}
          />
        </div>
        {error && <p className="aviso">{error}</p>}
        <button className="boton" type="submit" disabled={cargando}>
          {cargando ? "Guardando…" : "Guardar clave"}
        </button>
      </form>
    </div>
  );
}
