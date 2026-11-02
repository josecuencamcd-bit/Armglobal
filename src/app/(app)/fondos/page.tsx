"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { METODOS_FONDO, CATEG_GASTO } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";
import { fotoAJpegDataUrl } from "@/lib/fotos-cliente";
import { GraficoLinea } from "@/lib/grafico-linea";
import { VolverAdministracion } from "@/lib/volver-admin";

type Informe = {
  area: string;
  campus: string;
  mes: string;
  saldo: number;
  ingresos: number;
  egresos: number;
  areas: string[];
  puedeEditar: boolean;
  cierre: { cerrado: boolean; por: string; cuando: string; auto: boolean };
  comparacion: { actual: number; anterior: number; pct: number };
  historico: number;
  tendencia: { mes: string; monto: number }[];
};

function mesMover(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function nombreMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
}
function diasQuedan(mes: string) {
  const hoy = new Date();
  const act = hoy.toISOString().slice(0, 7);
  if (mes !== act) return "Este mes ya terminó.";
  const ultimo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate();
  const dia = hoy.getUTCDate();
  const q = ultimo - dia;
  return q > 0 ? `Quedan ${q} día${q === 1 ? "" : "s"} para que termine el mes.` : "Último día del mes.";
}

type Movimiento = {
  id: number;
  tipo: "aporte" | "gasto";
  fecha: string;
  monto: number;
  nombre?: string | null;
  comercio?: string | null;
  descripcion?: string | null;
  anulado: boolean;
};

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

/** Texto del informe mensual, para compartir por WhatsApp/correo — mismo
 * contenido que docFondo() de la app vieja (saldo, ingresos/egresos,
 * comparación con el mes anterior e histórico), armado del lado del
 * cliente a partir de lo que ya se cargó (sin pegarle a un endpoint nuevo). */
function textoInforme(inf: Informe, movs: Movimiento[] | null): string {
  const aportes = movs?.filter((m) => m.tipo === "aporte" && !m.anulado) ?? [];
  const gastos = movs?.filter((m) => m.tipo === "gasto" && !m.anulado) ?? [];
  const lineas = [
    `Fondo de ${inf.area} · ${inf.campus}`,
    nombreMes(inf.mes),
    "",
    `Saldo: ${fmt(inf.saldo)}`,
    `Ingresos: ${fmt(inf.ingresos)} (${aportes.length} aporte${aportes.length === 1 ? "" : "s"})`,
    `Gastos: ${fmt(inf.egresos)} (${gastos.length} gasto${gastos.length === 1 ? "" : "s"})`,
    "",
    `${inf.comparacion.pct >= 0 ? "▲" : "▼"} ${Math.abs(inf.comparacion.pct)}% vs. mes anterior (${fmt(inf.comparacion.anterior)})`,
    `Histórico acumulado: ${fmt(inf.historico)}`,
  ];
  if (inf.cierre.cerrado) {
    lineas.push("", `Mes cerrado${inf.cierre.auto ? " automáticamente" : ` por ${inf.cierre.por}`}.`);
  }
  return lineas.join("\n");
}

type Tab = "panel" | "aportes" | "gastos" | "informe";
const TABS: { key: Tab; label: string }[] = [
  { key: "panel", label: "Panel" },
  { key: "aportes", label: "Aportes" },
  { key: "gastos", label: "Gastos" },
  { key: "informe", label: "Informe" },
];

/** Módulo Fondos (fondo de equipo) — equivalente a Soporte → Fondo de la
 * app vieja: 4 pestañas (Panel/Aportes/Gastos/Informe), igual que
 * vFondo() en Code.gs. Contra /api/fondos/informe y /api/fondos. */
export default function FondosPage() {
  return (
    <Suspense fallback={<div className="contenedor">Cargando…</div>}>
      <FondosContenido />
    </Suspense>
  );
}

/** Desde Finanzas se llega acá con ?area=X ("Ver detalle" de un fondo de
 * equipo) — igual que vFinInforme() de la app vieja, donde cada fila de
 * `fondos` abre directo el fondo de esa área. */
function FondosContenido() {
  const { campusActivo } = useCampus();
  const areaInicial = useSearchParams().get("area");
  const [informe, setInforme] = useState<Informe | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("panel");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<number | null>(null);
  const [motivoAnular, setMotivoAnular] = useState("");
  const [pidiendoAut, setPidiendoAut] = useState(false);
  const [motivoAut, setMotivoAut] = useState("");
  const [enviandoAut, setEnviandoAut] = useState(false);
  const [autPendiente, setAutPendiente] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async (a: string | null, mes?: string) => {
    const qs = new URLSearchParams({ campus: campusActivo });
    if (a) qs.set("area", a);
    if (mes) qs.set("mes", mes);
    const res = await fetch(`/api/fondos/informe?${qs.toString()}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    setArea(json.data.area);
    setError(null);
    const rm = await fetch(`/api/fondos?campus=${encodeURIComponent(json.data.campus)}&area=${encodeURIComponent(json.data.area)}`);
    const jm = await rm.json();
    if (jm.ok) setMovs(jm.data.filter((m: Movimiento) => m.fecha.slice(0, 7) === json.data.mes).slice(0, 30));

    if (json.data.cierre?.cerrado) {
      const ra = await fetch("/api/fondos/autorizaciones");
      const ja = await ra.json();
      if (ja.ok) {
        setAutPendiente(
          (ja.data as { campus: string; area: string; mes: string; estado: string }[]).some(
            (x) => x.campus === json.data.campus && x.area === json.data.area && x.mes === json.data.mes
              && (x.estado === "Pendiente Pastor" || x.estado === "Pendiente Admin")
          )
        );
      }
    } else {
      setAutPendiente(false);
    }
  }, [campusActivo]);

  useEffect(() => {
    cargar(areaInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar]);

  function abrirAnular(id: number) {
    setAnulando(id);
    setMotivoAnular("");
  }

  async function confirmarAnular(id: number) {
    if (motivoAnular.trim().length < 5) { setError("Cuenta el motivo de la anulación (mínimo 5 caracteres)."); return; }
    const res = await fetch(`/api/fondos/${id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoAnular.trim() }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setAnulando(null);
    setMotivoAnular("");
    await cargar(area, informe?.mes);
  }

  async function manejarFoto(file: File | undefined) {
    if (!file) { setFoto(null); return; }
    setFotoError(null);
    try {
      setFoto(await fotoAJpegDataUrl(file));
    } catch (e) {
      setFotoError(e instanceof Error ? e.message : "No se pudo procesar la foto.");
    }
  }

  async function pedirAutorizacion() {
    if (!informe) return;
    if (motivoAut.trim().length < 8) { setError("Cuenta con claridad qué necesitas corregir y por qué."); return; }
    setEnviandoAut(true);
    const res = await fetch("/api/fondos/autorizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: informe.campus, area: informe.area, mes: informe.mes, motivo: motivoAut.trim() }),
    });
    const json = await res.json();
    setEnviandoAut(false);
    if (!json.ok) { setError(json.error); return; }
    setPidiendoAut(false);
    setMotivoAut("");
    setAutPendiente(true);
    setError(null);
  }

  async function registrar(fd: FormData, tipo: "aporte" | "gasto") {
    if (!informe) return;
    setGuardando(true);
    const body: Record<string, unknown> = {
      tipo,
      fecha: fd.get("fecha"),
      campus: informe.campus,
      area: informe.area,
      monto: Number(fd.get("monto")),
      foto: foto || undefined,
      motivo: (fd.get("motivo") as string)?.trim() || undefined,
    };
    if (tipo === "aporte") {
      body.nombre = fd.get("nombre");
      body.metodo = fd.get("metodo");
      body.descripcion = fd.get("descripcion") || undefined;
    } else {
      body.comercio = fd.get("comercio");
      body.boleta = fd.get("boleta");
      body.categoria = fd.get("categoria");
      body.descripcion = fd.get("descripcion");
    }
    const res = await fetch("/api/fondos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    setFoto(null);
    await cargar(area, informe.mes);
  }

  async function cerrarMes() {
    if (!informe) return;
    setCerrando(true);
    const res = await fetch("/api/fondos/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: informe.campus, area: informe.area, mes: informe.mes }),
    });
    const json = await res.json();
    setCerrando(false);
    if (!json.ok) { setError(json.error); return; }
    await cargar(area, informe.mes);
  }

  async function compartirInforme() {
    if (!informe) return;
    const texto = textoInforme(informe, movs);
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* el usuario canceló */ }
    }
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  if (!informe && !error) return <div className="contenedor">Cargando…</div>;

  const aportesDelMes = movs?.filter((m) => m.tipo === "aporte") ?? [];
  const gastosDelMes = movs?.filter((m) => m.tipo === "gasto") ?? [];

  function listaMovs(lista: Movimiento[]) {
    if (lista.length === 0) return <p className="muted">Sin movimientos registrados este mes.</p>;
    return lista.map((m) => (
      <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
        <div className="fila" style={{ border: 0, padding: 0 }}>
          <div>
            <div>{m.tipo === "aporte" ? m.nombre : m.comercio}{m.anulado ? " (anulado)" : ""}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{m.fecha} · {m.descripcion ?? ""}</div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="num" style={{ color: m.tipo === "aporte" ? "var(--ok)" : "var(--danger)" }}>
              {m.tipo === "aporte" ? "+" : "-"}{fmt(m.monto)}
            </span>
            {informe?.puedeEditar && !m.anulado && anulando !== m.id && (
              <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => abrirAnular(m.id)}>
                Anular
              </button>
            )}
          </span>
        </div>
        {anulando === m.id && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <input
              placeholder="Motivo de la anulación (mínimo 5 caracteres)"
              value={motivoAnular}
              onChange={(e) => setMotivoAnular(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="boton-peligro" style={{ fontSize: "0.78rem" }} onClick={() => confirmarAnular(m.id)}>Confirmar anulación</button>
              <button className="boton-secundario" style={{ fontSize: "0.78rem" }} onClick={() => setAnulando(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    ));
  }

  function formularioRegistro(tipoForm: "aporte" | "gasto") {
    if (!informe?.puedeEditar) return null;
    return (
      <>
        <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Cerrar" : `Registrar ${tipoForm}`}
        </button>
        {mostrarForm && (
          <form className="tarjeta" action={(fd) => registrar(fd, tipoForm)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="campo">
              <label>Fecha</label>
              <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="campo">
              <label>Monto</label>
              <input name="monto" type="number" required />
            </div>
            {tipoForm === "aporte" ? (
              <>
                <div className="campo">
                  <label>Quién aporta</label>
                  <input name="nombre" required />
                </div>
                <div className="campo">
                  <label>Método</label>
                  <select name="metodo">
                    {METODOS_FONDO.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="campo">
                  <label>Comercio</label>
                  <input name="comercio" required />
                </div>
                <div className="campo">
                  <label>N° de boleta</label>
                  <input name="boleta" placeholder="o S/B si no tiene" required />
                </div>
                <div className="campo">
                  <label>Categoría</label>
                  <select name="categoria">
                    {CATEG_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="campo">
              <label>Descripción</label>
              <textarea name="descripcion" rows={2} required={tipoForm === "gasto"} />
            </div>
            <div className="campo">
              <label>Foto del comprobante (opcional)</label>
              <input type="file" accept="image/*" onChange={(e) => manejarFoto(e.target.files?.[0])} />
              {fotoError && <p className="aviso" style={{ margin: "4px 0 0" }}>{fotoError}</p>}
              {foto && <p className="ok" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>Foto lista para enviar.</p>}
            </div>
            {informe.cierre.cerrado && (
              <div className="campo">
                <label>Motivo (mes cerrado)</label>
                <textarea name="motivo" rows={2} placeholder="Por qué corresponde registrar esto fuera de plazo" />
              </div>
            )}
            <button className="boton" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Registrar"}
            </button>
          </form>
        )}
      </>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Fondos</h1>
      {error && <p className="aviso">{error}</p>}

      {informe && (
        <>
          {informe.areas.length > 1 && (
            <div className="campo">
              <label>Equipo</label>
              <select value={area ?? informe.area} onChange={(e) => cargar(e.target.value, informe.mes)}>
                {informe.areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
            <button className="boton-secundario" onClick={() => cargar(area, mesMover(informe.mes, -1))}>‹</button>
            <strong>{nombreMes(informe.mes)}</strong>
            <button className="boton-secundario" onClick={() => cargar(area, mesMover(informe.mes, 1))}>›</button>
          </div>

          <div className="seg" style={{ marginBottom: 16 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                aria-pressed={tab === t.key}
                onClick={() => { setTab(t.key); setMostrarForm(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "panel" && (
            <>
              <div className="tarjeta">
                <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>SALDO · {informe.area} · {informe.campus}</p>
                <p className="num" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0" }}>{fmt(informe.saldo)}</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  Ingresos {fmt(informe.ingresos)} · Gastos {fmt(informe.egresos)}
                </p>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
                  {informe.comparacion.pct >= 0 ? "▲" : "▼"} {Math.abs(informe.comparacion.pct)}% vs. mes anterior ({fmt(informe.comparacion.anterior)}) · Histórico {fmt(informe.historico)}
                </p>
                {informe.tendencia.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <GraficoLinea datos={informe.tendencia} />
                  </div>
                )}
              </div>

              {informe.cierre.cerrado ? (
                <div className="tarjeta" style={{ marginTop: 12 }}>
                  <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 10px" }}>
                    Mes cerrado{informe.cierre.auto ? " automáticamente" : ` por ${informe.cierre.por}`}.
                  </p>
                  {autPendiente ? (
                    <p className="aviso" style={{ margin: 0 }}>Ya pediste autorización — esperando aprobación.</p>
                  ) : pidiendoAut ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="campo" style={{ marginBottom: 0 }}>
                        <label>Motivo</label>
                        <textarea rows={3} value={motivoAut} maxLength={300} placeholder="¿Qué necesitas corregir y por qué?" onChange={(e) => setMotivoAut(e.target.value)} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="boton" disabled={enviandoAut} onClick={pedirAutorizacion}>Enviar solicitud</button>
                        <button className="boton-secundario" onClick={() => { setPidiendoAut(false); setMotivoAut(""); }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button className="boton-secundario" onClick={() => setPidiendoAut(true)}>Pedir autorización para modificar</button>
                  )}
                </div>
              ) : informe.puedeEditar ? (
                <div className="tarjeta" style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 600 }}>Cierre de {nombreMes(informe.mes)}</p>
                  <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
                    {diasQuedan(informe.mes)} Si no cierras, se cierra solo el día 5.
                  </p>
                  <button className="boton-secundario" disabled={cerrando} onClick={cerrarMes}>
                    {cerrando ? "Cerrando…" : "Cerrar mes"}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {tab === "aportes" && (
            <>
              {formularioRegistro("aporte")}
              <p className="muted" style={{ margin: "16px 0 8px" }}>Aportes de {nombreMes(informe.mes)}</p>
              {listaMovs(aportesDelMes)}
            </>
          )}

          {tab === "gastos" && (
            <>
              {formularioRegistro("gasto")}
              <p className="muted" style={{ margin: "16px 0 8px" }}>Gastos de {nombreMes(informe.mes)}</p>
              {listaMovs(gastosDelMes)}
            </>
          )}

          {tab === "informe" && (
            <div className="tarjeta">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>INFORME · LISTO PARA COMPARTIR</p>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.88rem", margin: "0 0 14px" }}>
                {textoInforme(informe, movs)}
              </pre>
              <button className="boton" onClick={compartirInforme}>
                {copiado ? "Copiado ✓" : "Compartir / copiar"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
