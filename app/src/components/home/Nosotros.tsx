import { useCountUp } from '../../hooks/useCountUp';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { useParallax } from '../../hooks/useParallax';

const STATS = [
  { target: 12, sufijo: '+', label: 'Años de experiencia' },
  { target: 400, sufijo: '+', label: 'Operaciones cerradas' },
  { target: 98, sufijo: '%', label: 'Clientes conformes' },
];

const BADGES = ['Corredor matriculado', 'Especialista en Tandil', 'Asesoramiento sin presiones'];

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
  const { ref: copyRef, visible: copyVisible } = useRevealOnScroll<HTMLDivElement>();
  const { ref: photoRef, visible: photoVisible } = useRevealOnScroll<HTMLDivElement>();
  const photoParallax = useParallax<HTMLDivElement>(0.1);

  return (
    <section id="nosotros" className="section">
      <div className="container nosotros-inner">
        <div className={`reveal${copyVisible ? ' visible' : ''}`} ref={copyRef}>
          <span className="eyebrow">Nosotros</span>
          <h2 className="section-title">Facundo París, tu corredor en Tandil</h2>
          <p className="section-intro">
            Al frente de la inmobiliaria desde hace más de una década, acompañando a familias e inversores de Tandil
            en cada etapa de la compra, venta y alquiler de sus propiedades — con un trato cercano y asesoramiento
            real en cada operación.
          </p>

          <div className="nosotros-stats">
            {STATS.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>

          <div className="nosotros-badges">
            {BADGES.map((b) => (
              <div className="nosotros-badge-pill" key={b}>
                <span />
                {b}
              </div>
            ))}
          </div>
        </div>

        <div className={`nosotros-photo-wrap reveal${photoVisible ? ' visible' : ''}`} ref={photoRef}>
          <div className="nosotros-photo parallax-el" ref={photoParallax}>
            <span className="nosotros-photo-placeholder">Foto próximamente</span>
          </div>
          <div className="nosotros-matricula">
            <div className="nosotros-matricula-val">1826</div>
            <div className="nosotros-matricula-lbl">Matrícula habilitada</div>
          </div>
        </div>
      </div>
    </section>
  );
}
