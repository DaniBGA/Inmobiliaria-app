interface MiniAreaProps {
  puntos: { label: string; valor: number }[];
}

// Área simple (recaudación de los últimos N meses). No es el chart exacto
// del boceto (que era una implementación SVG a mano más elaborada), pero
// usa los mismos colores y transmite la misma idea con datos reales.
export function MiniArea({ puntos }: MiniAreaProps) {
  const w = 560;
  const h = 180;
  const pad = 28;
  const max = Math.max(...puntos.map((p) => p.valor), 1);

  const stepX = puntos.length > 1 ? (w - pad * 2) / (puntos.length - 1) : 0;
  const coords = puntos.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (p.valor / max) * (h - pad * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1]?.x ?? pad},${h - pad} L${pad},${h - pad} Z`;

  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${w} ${h}`}>
        <path d={areaPath} fill="var(--indigo-soft)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--ink)" strokeWidth={2} />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={3} fill="var(--ink)" />
        ))}
        {coords.map((c) => (
          <text key={c.label} x={c.x} y={h - 6} textAnchor="middle">
            {c.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
