import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ModalidadPropiedad, type TipoPropiedad } from '../../api/propiedades';
import { TIPO_LABEL } from '../../lib/format';
import fotoHero from '../../images/FOTO1.png';

export function Hero() {
  const navigate = useNavigate();
  const [modalidad, setModalidad] = useState<ModalidadPropiedad>('VENTA');
  const [tipo, setTipo] = useState<TipoPropiedad | ''>('');

  function buscar() {
    const q = new URLSearchParams({ modalidad });
    if (tipo) q.set('tipo', tipo);
    navigate(`/propiedades?${q.toString()}`);
  }

  return (
    <section id="inicio" className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">Inmobiliaria en Tandil</span>
          <h1 className="hero-title">Encontrá el lugar que estabas buscando</h1>
          <p className="hero-sub">
            Compra, venta y alquiler de propiedades en Tandil, con el acompañamiento de un equipo que conoce cada
            barrio de la ciudad.
          </p>

          <div className="search-widget">
            <div className="search-tabs">
              <button
                type="button"
                className={modalidad === 'VENTA' ? 'active' : ''}
                onClick={() => setModalidad('VENTA')}
              >
                Comprar
              </button>
              <button
                type="button"
                className={modalidad === 'ALQUILER' ? 'active' : ''}
                onClick={() => setModalidad('ALQUILER')}
              >
                Alquilar
              </button>
            </div>
            <div className="search-fields">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPropiedad | '')}>
                <option value="">Tipo de propiedad</option>
                {Object.entries(TIPO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={buscar}>
                Buscar
              </button>
            </div>
          </div>
        </div>

        <div className="hero-image">
          <img src={fotoHero} alt="Tandil" />
        </div>
      </div>
    </section>
  );
}
