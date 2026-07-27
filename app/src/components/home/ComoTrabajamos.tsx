import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';

const PASOS = [
  {
    n: '01',
    titulo: 'Valuación',
    texto: 'Analizamos tu propiedad y el mercado de Tandil para definir el mejor precio de publicación.',
  },
  {
    n: '02',
    titulo: 'Marketing',
    texto: 'Fotos, difusión en redes y en nuestra cartera de contactos para llegar al comprador o inquilino correcto.',
  },
  {
    n: '03',
    titulo: 'Cierre',
    texto: 'Te acompañamos en la negociación y en toda la documentación hasta la firma.',
  },
];

export function ComoTrabajamos() {
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section id="servicios" className="section">
      <div className="container">
        <span className="eyebrow">Cómo trabajamos</span>
        <h2 className="section-title">Un proceso simple y transparente</h2>

        <div className={`pasos-grid${visible ? ' visible' : ''}`} ref={ref}>
          {PASOS.map((p) => (
            <div className="paso-card" key={p.n}>
              <span className="paso-n">{p.n}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
