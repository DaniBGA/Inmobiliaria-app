import { useState } from 'react';

export interface FuncionGuia {
  titulo: string;
  subtitulo: string;
  pasos?: string[];
}

interface SeccionGuiaProps {
  icono: string;
  titulo: string;
  intro?: string;
  // Cada posición del array es una página del cartel — si hay una sola,
  // no se muestra paginado; si hay más de una, aparece el navegador
  // ‹ Página X de N › para que quepan todas las funcionalidades sin
  // que el cartel se vuelva gigante (pedido del usuario 2026-08-27).
  paginas: FuncionGuia[][];
}

export function SeccionGuia({ icono, titulo, intro, paginas }: SeccionGuiaProps) {
  const [pagina, setPagina] = useState(0);
  const total = paginas.length;
  const actual = paginas[Math.min(pagina, total - 1)] ?? [];

  return (
    <div className="notice guia">
      <div className="ico">{icono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{titulo}</b>
        {intro && <p style={{ marginBottom: 8 }}>{intro}</p>}
        <ul>
          {actual.map((f) => (
            <li key={f.titulo}>
              <b>{f.titulo}</b> — {f.subtitulo}
              {f.pasos && f.pasos.length > 0 && (
                <ol className="guia-pasos">
                  {f.pasos.map((paso, i) => (
                    <li key={i}>{paso}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
        {total > 1 && (
          <div className="guia-pag">
            <button
              type="button"
              className="navm"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              title="Página anterior"
            >
              ‹
            </button>
            <span>
              Página {pagina + 1} de {total}
            </span>
            <button
              type="button"
              className="navm"
              disabled={pagina === total - 1}
              onClick={() => setPagina((p) => Math.min(total - 1, p + 1))}
              title="Página siguiente"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
