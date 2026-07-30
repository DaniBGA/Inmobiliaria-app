import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { waLink } from '../../lib/format';
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
  const { ref: ctaRef, visible: ctaVisible } = useRevealOnScroll<HTMLDivElement>();
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

  return (
    <section id="servicios" className="section">
      <div className="container">
        <span className="eyebrow">Cómo trabajamos</span>
        <h2 className="section-title">Un proceso simple y transparente</h2>

        <div className={`pasos-grid reveal${visible ? ' visible' : ''}`} ref={ref}>
          {PASOS.map((p) => (
            <div className="paso-card" key={p.n}>
              <span className="paso-n">{p.n}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>

        {contactoInfo.data?.whatsapp && (
          <div className={`servicios-cta reveal${ctaVisible ? ' visible' : ''}`} ref={ctaRef}>
            <div className="servicios-cta-copy">
              <div className="servicios-cta-eyebrow">Desarrolladores e inversores</div>
              <h3 className="servicios-cta-title">¿Tenés algo en mente? Contactanos.</h3>
              <p className="servicios-cta-text">
                Proyectos de pozo, loteos, edificios o comercialización de emprendimientos: pensamos la estrategia de
                venta con vos, desde la primera unidad hasta la última.
              </p>
            </div>
            <a
              className="servicios-cta-btn"
              href={waLink(contactoInfo.data.whatsapp, 'Hola! Quiero contarte sobre un proyecto/inversión.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hablemos de tu proyecto →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
