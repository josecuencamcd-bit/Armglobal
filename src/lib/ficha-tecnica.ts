/**
 * Lee en vivo la planilla "PUQ - Fichas Técnicas Campus Punta Arenas" que
 * arma el equipo técnico (compartida "cualquiera con el enlace"), para que
 * Predicador/Siembra/Despedida/Producción de la ficha completa se copien
 * automático en vez de escribirse dos veces. Si la planilla no responde o
 * el servicio no tiene hoja mapeada, devuelve null y la pantalla cae a lo
 * que haya guardado manual en `ficha_cabecera`.
 */
const SPREADSHEET_ID = "1ES1zObjm6MqLnHrNdsr4zms576KKcqFPGWlUYQ5fckI";

const HOJA_POR_SERVICIO: Record<string, string> = {
  "Jueves 8pm": "Jueves",
  "Domingo 11am": "Bloque I Domingo",
  "Domingo 6pm": "Bloque II Domingo",
};

export type FichaTecnica = {
  predicador: string;
  siembra: string;
  despedida: string;
  productorGeneral: string;
  encargadosTecnicos: string;
  productorEncuentro: string;
} | null;

/** Parser de CSV mínimo pero correcto con comillas (campos con comas o
 * saltos de línea adentro, como "Info Bienvenida" en la planilla real). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

export async function fichaTecnicaDeServicio(servicio: string): Promise<FichaTecnica> {
  const hoja = HOJA_POR_SERVICIO[servicio];
  if (!hoja) return null;

  let texto: string;
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    texto = await res.text();
  } catch {
    return null;
  }

  // Etiqueta en columna C, valor en columna D — misma estructura en las 3
  // hojas (Jueves / Bloque I Domingo / Bloque II Domingo).
  const mapa = new Map<string, string>();
  for (const fila of parseCSV(texto)) {
    const etiqueta = (fila[2] ?? "").trim().toLowerCase();
    const valor = (fila[3] ?? "").trim();
    if (etiqueta && !mapa.has(etiqueta)) mapa.set(etiqueta, valor);
  }
  const buscar = (...claves: string[]) => {
    for (const k of claves) {
      const v = mapa.get(k.toLowerCase());
      if (v) return v;
    }
    return "";
  };

  return {
    predicador: buscar("predicacion", "predicación"),
    siembra: buscar("siembra"),
    despedida: buscar("info & despedida"),
    productorGeneral: buscar("productor general"),
    encargadosTecnicos: buscar("encargado técnico de campus", "encargado tecnico de campus"),
    productorEncuentro: buscar("productor de encuentro"),
  };
}
