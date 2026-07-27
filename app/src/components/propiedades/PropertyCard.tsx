import { useQuery } from '@tanstack/react-query';
import { BASE_URL } from '../../api/client';
import { type PropiedadPublica } from '../../api/propiedades';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { TIPO_LABEL, formatPrecio, formatMoney, waLink } from '../../lib/format';

// Paleta de gradientes de respaldo cuando la propiedad todavía no tiene
// fotos cargadas — mismo criterio de "placeholder prolijo" que usaba el
// boceto original, en vez de un ícono roto.
const GRADIENTES = [
  'linear-gradient(135deg, #2c4263, #1b3050)',
  'linear-gradient(135deg, #1f3a5c, #14253b)',
  'linear-gradient(135deg, #34507a, #1e3350)',
  'linear-gradient(135deg, #26405f, #14253b)',
];

function gradienteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTES[Math.abs(hash) % GRADIENTES.length];
}

export function PropertyCard({ propiedad }: { propiedad: PropiedadPublica }) {
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

  const foto = propiedad.fotos[0];
  const precio =
    propiedad.modalidad === 'VENTA' ? formatPrecio(propiedad.precio, propiedad.moneda) : formatMoney(propiedad.montoAlquilerVigente);
  const specs = [
    propiedad.ambientes != null ? `Amb. ${propiedad.ambientes}` : null,
    propiedad.banos != null ? `Baños ${propiedad.banos}` : null,
    propiedad.superficieM2 != null ? `Sup. ${propiedad.superficieM2}m²` : null,
  ].filter(Boolean) as string[];

  const whatsapp = contactoInfo.data?.whatsapp;
  const mensaje = `Hola! Me interesa la propiedad "${propiedad.nombre}" (${propiedad.direccion}).`;

  return (
    <article className="property-card">
      <div className="property-photo" style={foto ? undefined : { background: gradienteFor(propiedad.id) }}>
        {foto ? <img src={`${BASE_URL}${foto.url}`} alt={propiedad.nombre} /> : <span className="property-photo-caption">{TIPO_LABEL[propiedad.tipo] ?? propiedad.tipo}</span>}
        <span className="property-modalidad">{propiedad.modalidad === 'VENTA' ? 'En venta' : 'Alquiler'}</span>
      </div>
      <div className="property-body">
        <div className="property-price">{precio}</div>
        <h3 className="property-title">{propiedad.nombre}</h3>
        <div className="property-address">
          {propiedad.direccion} · {TIPO_LABEL[propiedad.tipo] ?? propiedad.tipo}
        </div>
        {specs.length > 0 && <div className="property-specs">{specs.join(' · ')}</div>}
        {whatsapp && (
          <a className="btn btn-whatsapp property-cta" href={waLink(whatsapp, mensaje)} target="_blank" rel="noopener noreferrer">
            Consultar por WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
