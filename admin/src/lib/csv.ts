function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// BOM + separador ";" porque es lo que Excel en español abre correctamente
// sin pedirle nada al usuario (mismo criterio que el boceto).
export function descargarCsv(nombre: string, filas: unknown[][]) {
  const txt = filas.map((f) => f.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}
