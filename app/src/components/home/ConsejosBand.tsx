import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../../api/configuracionPublica';

const TIPS = [
  {
    titulo: '¿Qué documentación necesito para vender?',
    texto: 'Escritura, últimos impuestos al día y, si corresponde, el reglamento de copropiedad. Te ayudamos a reunir todo antes de publicar.',
  },
  {
    titulo: '¿Cómo se define el precio de publicación?',
    texto: 'Comparamos con operaciones recientes de la zona y el estado de la propiedad para llegar a un valor realista que se venda o alquile en un plazo razonable.',
  },
  {
    titulo: '¿Qué gastos tiene una operación?',
    texto: 'Honorarios profesionales, sellado y gastos de escrituración — te los detallamos por adelantado, sin sorpresas.',
  },
];

export function ConsejosBand() {
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="section dark">
      <div className="container">
        <span className="eyebrow">Consejos inmobiliarios</span>
        <h2 className="section-title" style={{ color: '#fff' }}>
          Preguntas frecuentes
        </h2>

        <div className="consejos-grid">
          {TIPS.map((t) => (
            <div className="consejo-card" key={t.titulo}>
              <h3>{t.titulo}</h3>
              <p>{t.texto}</p>
            </div>
          ))}
        </div>

        {contactoInfo.data?.instagramUrl && (
          <a
            href={contactoInfo.data.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ marginTop: 36 }}
          >
            Seguinos en Instagram
          </a>
        )}
      </div>
    </section>
  );
}
