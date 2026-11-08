"use client";

import { useEffect, useState } from "react";
import { descargarPdf, descargarCsv } from "@/lib/reportes-cliente";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  mensajeInicial: string;
  nombreArchivo: string;
};

/**
 * Mismo flujo que el "Compartir" de la app vieja: una ventana con el
 * mensaje de WhatsApp editable (Cerrar / Copiar mensaje) y, aparte, un
 * botón "PDF, Excel o correo" que abre las tres formas de exportar el
 * mismo reporte — reemplaza el alert/share nativo que se mostraba acá en
 * desktop por algo utilizable sin salir de la app.
 */
export default function ModalCompartir({ abierto, onCerrar, titulo, mensajeInicial, nombreArchivo }: Props) {
  const [mensaje, setMensaje] = useState(mensajeInicial);
  const [mostrarExportar, setMostrarExportar] = useState(false);
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setMensaje(mensajeInicial);
      setMostrarExportar(false);
      setResultado(null);
      fetch("/api/perfil")
        .then((r) => r.json())
        .then((json) => { if (json.ok && json.data?.correo) setCorreo(json.data.correo); })
        .catch(() => {});
    }
  }, [abierto, mensajeInicial]);

  if (!abierto) return null;

  function copiar() {
    navigator.clipboard.writeText(mensaje);
    setResultado("Mensaje copiado al portapapeles.");
  }

  // El mismo texto editable, convertido a filas "Etiqueta; Valor" para el
  // PDF/CSV — igual que mostraba la app vieja al exportar lo que se veía
  // en el cuadro de WhatsApp.
  function filas(): [string, string][] {
    return mensaje.split("\n").map((linea) => {
      const limpia = linea.replace(/\*/g, "").trim();
      const i = limpia.indexOf(":");
      if (i === -1) return [limpia, ""];
      return [limpia.slice(0, i).trim(), limpia.slice(i + 1).trim()];
    });
  }

  function pdf() {
    descargarPdf(titulo, mensaje.split("\n"), nombreArchivo);
  }

  function csv() {
    descargarCsv(filas(), nombreArchivo);
  }

  async function enviarCorreo() {
    if (!correo.trim()) { setResultado("Escribe un correo de destino."); return; }
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/reportes/correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinatario: correo.trim(), asunto: titulo, titulo, texto: mensaje }),
      });
      const json = await res.json();
      setResultado(json.ok ? `Enviado a ${correo.trim()}.` : json.error ?? "No se pudo enviar.");
    } catch {
      setResultado("No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onCerrar}
    >
      <div
        className="tarjeta"
        style={{ width: "100%", maxWidth: 480, margin: "0 0 0", borderRadius: "16px 16px 0 0", maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="muted" style={{ letterSpacing: 1, fontSize: "0.72rem", margin: "0 0 8px" }}>MENSAJE PARA WHATSAPP</p>
        <div className="campo" style={{ marginBottom: 0 }}>
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={10}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="boton-secundario" style={{ flex: 1 }} onClick={onCerrar}>Cerrar</button>
          <button type="button" className="boton" style={{ flex: 1, background: "var(--ok)" }} onClick={copiar}>Copiar mensaje</button>
        </div>

        <button
          type="button"
          className="boton"
          style={{ width: "100%", marginTop: 8, background: "var(--gold-grad)", color: "var(--accent-ink)" }}
          onClick={() => setMostrarExportar((v) => !v)}
        >
          PDF, Excel o correo
        </button>

        {mostrarExportar && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="boton-secundario" style={{ flex: 1, width: "auto" }} onClick={pdf}>Descargar PDF</button>
              <button type="button" className="boton-secundario" style={{ flex: 1, width: "auto" }} onClick={csv}>Descargar Excel</button>
            </div>
            <div className="campo">
              <label>Enviar por correo</label>
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <button type="button" className="boton" style={{ width: "100%" }} disabled={enviando} onClick={enviarCorreo}>
              {enviando ? "Enviando…" : "Enviar correo"}
            </button>
          </div>
        )}

        {resultado && <p className="muted" style={{ marginTop: 10, fontSize: "0.8rem" }}>{resultado}</p>}
      </div>
    </div>
  );
}
