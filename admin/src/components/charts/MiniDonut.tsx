interface MiniDonutProps {
  a: { label: string; valor: number; color: string };
  b: { label: string; valor: number; color: string };
}

export function MiniDonut({ a, b }: MiniDonutProps) {
  const total = a.valor + b.valor;
  const r = 60;
  const circumference = 2 * Math.PI * r;
  const pctA = total > 0 ? a.valor / total : 0;
  const dashA = circumference * pctA;

  return (
    <div className="chartbox" style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 160 160" style={{ width: '100%', maxWidth: 230, height: 'auto' }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--bg2)" strokeWidth={20} />
        {total > 0 && (
          <>
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={20}
              strokeDasharray={`${dashA} ${circumference - dashA}`}
              strokeDashoffset={circumference * 0.25}
              transform="rotate(-90 80 80)"
            />
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={b.color}
              strokeWidth={20}
              strokeDasharray={`${circumference - dashA} ${dashA}`}
              strokeDashoffset={circumference * 0.25 - dashA}
              transform="rotate(-90 80 80)"
            />
          </>
        )}
        <text x="80" y="76" textAnchor="middle" fontFamily="var(--mono)" fontSize="22" fontWeight={700} fill="var(--ink)">
          {total}
        </text>
        <text x="80" y="94" textAnchor="middle" fontSize="10" fill="var(--muted)">
          contratos
        </text>
      </svg>
    </div>
  );
}
