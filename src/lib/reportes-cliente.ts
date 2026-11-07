/**
 * Export de reportes al estilo de la app vieja (Code.gs generaba PDF/Excel
 * desde Google Sheets con MailApp). Acá se arma todo en el cliente:
 * - PDF: texto plano con jsPDF, una línea por fila (envuelve si es larga).
 * - "Excel": CSV (Excel/Sheets lo abren directo) con comillas donde haga
 *   falta — no se agrega la librería `xlsx` completa solo para esto.
 */
import { jsPDF } from "jspdf";

export function descargarPdf(titulo: string, lineas: string[], archivo: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margen = 40;
  const anchoUtil = doc.internal.pageSize.getWidth() - margen * 2;
  let y = margen;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, margen, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const linea of lineas) {
    const limpia = linea.replace(/\*/g, "");
    const partidas = doc.splitTextToSize(limpia || " ", anchoUtil);
    for (const parte of partidas) {
      if (y > doc.internal.pageSize.getHeight() - margen) {
        doc.addPage();
        y = margen;
      }
      doc.text(parte, margen, y);
      y += 14;
    }
  }

  doc.save(archivo.endsWith(".pdf") ? archivo : `${archivo}.pdf`);
}

function celdaCsv(valor: string) {
  const v = String(valor ?? "");
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function descargarCsv(filas: [string, string][], archivo: string) {
  const texto = "﻿" + filas.map(([a, b]) => `${celdaCsv(a)};${celdaCsv(b)}`).join("\n");
  const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.endsWith(".csv") ? archivo : `${archivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
