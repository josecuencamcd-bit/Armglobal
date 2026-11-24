"use client";

import { useEffect, useState } from "react";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  mensajeInicial: string;
  nombreArchivo: string;
};

/**
 * Mismo flujo que el "Compartir" de la app vieja: una ventana con el
 * mensaje de WhatsApp editable (Cerrar / Copiar mensaje) — sin PDF,
 * Excel ni envío por correo (se sacaron a pedido, no hacían falta).
 */
export default function ModalCompartir({ abierto, onCerrar, mensajeInicial }: Props) {
  const [mensaje, setMensaje] = useState(mensajeInicial);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setMensaje(mensajeInicial);
      setResultado(null);
    }
  }, [abierto, mensajeInicial]);

  if (!abierto) return null;

  function copiar() {
    navigator.clipboard.writeText(mensaje);
    setResultado("Mensaje copiado al portapapeles.");
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

        {resultado && <p className="muted" style={{ marginTop: 10, fontSize: "0.8rem" }}>{resultado}</p>}
      </div>
    </div>
  );
}
