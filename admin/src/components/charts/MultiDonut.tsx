interface Slice {
  label: string;
  valor: number;
  color: string;
}

interface MultiDonutProps {
  slices: Slice[];
  centerLabel?: string;
}

// Generalización de MiniDonut para N porciones en vez de solo 2 — misma
// técnica (stroke-dasharray/offset sobre un círculo, rotado -90° para
// arrancar a las 12), acumulando el offset porción por porción.
export function MultiDonut({ slices, centerLabel }: MultiDonutProps) {
  const total = slices.reduce((acc, s) => acc + s.valor, 0);
  const r = 60;
  const circumference = 2 * Math.PI * r;

  let acumulado = 0;

  return (
    <div className="chartbox" style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 160 160" style={{ width: '100%', maxWidth: 230, height: 'auto' }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--bg2)" strokeWidth={20} />
        {total > 0 &&
          slices.map((s, i) => {
            if (s.valor <= 0) return null;
            const pct = s.valor / total;
            const dash = circumference * pct;
            const offset = circumference * 0.25 - circumference * acumulado;
            acumulado += pct;
            return (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={20}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                transform="rotate(-90 80 80)"
              />
            );
          })}
        <text x="80" y="76" textAnchor="middle" fontFamily="var(--mono)" fontSize="22" fontWeight={700} fill="var(--ink)">
          {total}
        </text>
        <text x="80" y="94" textAnchor="middle" fontSize="10" fill="var(--muted)">
          {centerLabel ?? 'clientes'}
        </text>
      </svg>
    </div>
  );
}
