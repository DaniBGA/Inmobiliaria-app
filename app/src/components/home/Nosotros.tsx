import { useCountUp } from '../../hooks/useCountUp';

const STATS = [
  { target: 12, sufijo: '+', label: 'Años de experiencia' },
  { target: 400, sufijo: '+', label: 'Operaciones cerradas' },
  { target: 98, sufijo: '%', label: 'Clientes conformes' },
  { target: 1826, sufijo: '', label: 'Matrícula' },
];

function Stat({ target, sufijo, label }: { target: number; sufijo: string; label: string }) {
  const { ref, value } = useCountUp<HTMLDivElement>(target);
  return (
    <div className="nosotros-stat" ref={ref}>
      <span className="nosotros-stat-val">
        {value}
        {sufijo}
      </span>
      <span className="nosotros-stat-lbl">{label}</span>
    </div>
  );
}

export function Nosotros() {
  return (
    <section id="nosotros" className="section">
      <div className="container nosotros-inner">
        <div className="nosotros-photo">
          <span>[ retrato — Facundo Paris ]</span>
        </div>

        <div>
          <span className="eyebrow">Nosotros</span>
          <h2 className="section-title">Facundo Paris</h2>
          <p className="section-intro">
            Al frente de la inmobiliaria desde hace más de una década, acompañando a familias e inversores de
            Tandil en cada etapa de la compra, venta y alquiler de sus propiedades — con un trato cercano y
            asesoramiento real en cada operación.
          </p>

          <div className="nosotros-stats">
            {STATS.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>

          <a href="#contacto" className="btn btn-primary" style={{ marginTop: 28 }}>
            Conversemos
          </a>
        </div>
      </div>
    </section>
  );
}
