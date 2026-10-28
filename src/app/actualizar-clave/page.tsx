"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/** Reemplaza api_restablecer de Code.gs. Supabase redirige acá con una sesión
 * de recuperación temporal (tras click en el link del correo); updateUser
 * fija la clave nueva. También sirve para que cualquier usuario logueado
 * cambie su clave. */
export default function ActualizarClavePage() {
  const router = useRouter();
  const supabase = createClient();
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    // onAuthStateChange dispara PASSWORD_RECOVERY cuando el link del correo
    // ya estableció la sesión temporal en el navegador.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setListo(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setListo(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

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
