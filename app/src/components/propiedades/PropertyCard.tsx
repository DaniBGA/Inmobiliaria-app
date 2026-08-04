import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { BASE_URL } from '../../api/client';
import { type PropiedadPublica } from '../../api/propiedades';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { TIPO_LABEL, formatPrecio, formatMoney, waLink, gradienteFor, specsDe } from '../../lib/format';

function PropertyPhotoCarousel({
  propiedad,
  indice,
  setIndice,
}: {
  propiedad: PropiedadPublica;
  indice: number;
  setIndice: (i: number) => void;
}) {
  const fotos = propiedad.fotos;

  if (fotos.length === 0) {
    return (
      <div className="property-photo" style={{ background: gradienteFor(propiedad.id) }}>
        <span className="property-photo-caption">{TIPO_LABEL[propiedad.tipo] ?? propiedad.tipo}</span>
      </div>
    );
  }

  function anterior(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIndice(indice === 0 ? fotos.length - 1 : indice - 1);
  }
  function siguiente(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIndice(indice === fotos.length - 1 ? 0 : indice + 1);
  }

  return (
    <div className="property-photo">
      <img src={`${BASE_URL}${fotos[indice].url}`} alt={propiedad.nombre} />
      {fotos.length > 1 && (
        <>
          <button type="button" className="property-photo-nav prev" onClick={anterior} aria-label="Foto anterior">
            ‹
          </button>
          <button type="button" className="property-photo-nav next" onClick={siguiente} aria-label="Foto siguiente">
            ›
          </button>
          <div className="property-photo-dots">
            {fotos.map((f, i) => (
              <button
                type="button"
                key={f.id}
                className={i === indice ? 'active' : ''}
                aria-label={`Ver foto ${i + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndice(i);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PropertyDetailModal({
  propiedad,
  indice,
  setIndice,
  whatsapp,
  onClose,
}: {
  propiedad: PropiedadPublica;
  indice: number;
  setIndice: (i: number) => void;
  whatsapp: string | undefined;
  onClose: () => void;
}) {
  const fotos = propiedad.fotos;
  const foto = fotos[indice];
  const precio =
    propiedad.modalidad === 'VENTA' ? formatPrecio(propiedad.precio, propiedad.moneda) : formatMoney(propiedad.montoAlquilerVigente);
  const mensaje = `Hola! Me interesa la propiedad "${propiedad.nombre}" (${propiedad.direccion}).`;

  // Tipo/Modalidad ya están en el kicker de arriba, y Amb./Dorm./Baños/Sup.
  // ya salen en la tira de `specsDe` — acá solo va lo que no se muestra en
  // ningún otro lado todavía.
  const rows = [
    { k: 'Cochera', v: propiedad.cochera ? 'Sí' : 'No' },
    propiedad.superficieCubierta != null ? { k: 'Superficie cubierta', v: `${propiedad.superficieCubierta} m²` } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="property-modal-overlay" onClick={onClose}>
      <div className="property-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="property-modal-photo" style={foto ? undefined : { background: gradienteFor(propiedad.id) }}>
          {foto && (
            <>
              <div
                className="property-modal-photo-bg"
                style={{ backgroundImage: `url(${BASE_URL}${foto.url})` }}
                aria-hidden="true"
              />
              <img className="property-modal-photo-img" src={`${BASE_URL}${foto.url}`} alt={propiedad.nombre} />
            </>
          )}
          <button type="button" className="property-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
          <span className="property-modal-price">{precio}</span>
          {fotos.length > 1 && (
            <>
              <button
                type="button"
                className="property-photo-nav prev"
                style={{ opacity: 1 }}
                onClick={() => setIndice(indice === 0 ? fotos.length - 1 : indice - 1)}
                aria-label="Foto anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="property-photo-nav next"
                style={{ opacity: 1 }}
                onClick={() => setIndice(indice === fotos.length - 1 ? 0 : indice + 1)}
                aria-label="Foto siguiente"
              >
                ›
              </button>
              <div className="property-photo-dots">
                {fotos.map((f, i) => (
                  <button
                    type="button"
                    key={f.id}
                    className={i === indice ? 'active' : ''}
                    aria-label={`Ver foto ${i + 1}`}
                    onClick={() => setIndice(i)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="property-modal-body">
          <div className="property-kicker">
            {TIPO_LABEL[propiedad.tipo] ?? propiedad.tipo} · {propiedad.modalidad === 'VENTA' ? 'En venta' : 'Alquiler'}
          </div>
          <h3 className="property-title">{propiedad.direccion}</h3>
          {specsDe(propiedad).length > 0 && (
            <div className="property-specs">
              {specsDe(propiedad).map((s) => (
                <div key={s.k}>
                  <div className="property-spec-v">{s.v}</div>
                  <div className="property-spec-k">{s.k}</div>
                </div>
              ))}
            </div>
          )}
          <div className="property-modal-rows">
            {rows.map((r) => (
              <div className="property-modal-row" key={r.k}>
                <div className="property-modal-row-v">{r.v}</div>
                <div className="property-modal-row-k">{r.k}</div>
              </div>
            ))}
          </div>
          {propiedad.descripcion && <p className="property-modal-desc">{propiedad.descripcion}</p>}
          {whatsapp && (
            <a className="property-modal-cta" href={waLink(whatsapp, mensaje)} target="_blank" rel="noopener noreferrer">
              Consultar por esta propiedad →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function PropertyCard({ propiedad }: { propiedad: PropiedadPublica }) {
  const [indice, setIndice] = useState(0);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

  const precio =
    propiedad.modalidad === 'VENTA' ? formatPrecio(propiedad.precio, propiedad.moneda) : formatMoney(propiedad.montoAlquilerVigente);
  const specs = specsDe(propiedad);
  const whatsapp = contactoInfo.data?.whatsapp;
  const mensaje = `Hola! Me interesa la propiedad "${propiedad.nombre}" (${propiedad.direccion}).`;

  return (
    <article className="property-card">
      <div style={{ position: 'relative' }}>
        <PropertyPhotoCarousel propiedad={propiedad} indice={indice} setIndice={setIndice} />
        <span className="property-badge">
          <span className={`property-badge-dot${propiedad.modalidad === 'VENTA' ? ' venta' : ''}`} />
          {propiedad.modalidad === 'VENTA' ? 'En venta' : 'Alquiler'}
        </span>
        <span className="property-price-pill">{precio}</span>
      </div>
      <div className="property-body">
        <div className="property-kicker">
          {TIPO_LABEL[propiedad.tipo] ?? propiedad.tipo} · {propiedad.direccion}
        </div>
        <h3 className="property-title">{propiedad.nombre}</h3>
        {specs.length > 0 && (
          <div className="property-specs">
            {specs.map((s) => (
              <div key={s.k}>
                <div className="property-spec-v">{s.v}</div>
                <div className="property-spec-k">{s.k}</div>
              </div>
            ))}
          </div>
        )}
        <div className="property-actions">
          <button type="button" className="property-detail-btn" onClick={() => setDetalleAbierto(true)}>
            Ver detalle
          </button>
          {whatsapp && (
            <a className="property-cta" href={waLink(whatsapp, mensaje)} target="_blank" rel="noopener noreferrer">
              <span>Consultar</span>
              <span>→</span>
            </a>
          )}
        </div>
      </div>

      {detalleAbierto &&
        createPortal(
          <PropertyDetailModal
            propiedad={propiedad}
            indice={indice}
            setIndice={setIndice}
            whatsapp={whatsapp}
            onClose={() => setDetalleAbierto(false)}
          />,
          document.body,
        )}
    </article>
  );
}
