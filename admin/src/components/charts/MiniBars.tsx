import { formatMoney } from '../../lib/format';

interface MiniBarsProps {
  bruto: number;
  neto: number;
}

export function MiniBars({ bruto, neto }: MiniBarsProps) {
  const max = Math.max(bruto, neto, 1);
  const barW = 100;

  const Bar = ({ valor, color, label }: { valor: number; color: string; label: string }) => {
    const hMax = 180;
    const h = (valor / max) * hMax;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 14.5, fontWeight: 700 }}>{formatMoney(valor)}</div>
        <div style={{ width: barW, height: hMax, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', height: h, background: color, borderRadius: '8px 8px 0 0' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{label}</div>
      </div>
    );
  };

  return (
    <div className="chartbox" style={{ display: 'flex', justifyContent: 'center', gap: 52 }}>
      <Bar valor={bruto} color="var(--ink)" label="BRUTO" />
      <Bar valor={neto} color="var(--indigo)" label="NETO" />
    </div>
  );
}
