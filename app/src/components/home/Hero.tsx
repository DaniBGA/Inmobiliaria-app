import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarPropiedades, type ModalidadPropiedad, type TipoPropiedad } from '../../api/propiedades';
import { BASE_URL } from '../../api/client';
import { TIPO_LABEL, formatPrecio, formatMoney, gradienteFor, specsLineDe } from '../../lib/format';
import { useParallax } from '../../hooks/useParallax';
import fondoHero from '../../images/fondoHero.jpg';

const SLIDE_MS = 5500;

const HERO_STATS = [
  { val: '200+', lbl: 'Publicaciones' },
  { val: '3.8k', lbl: 'Seguidores' },
  { val: '1826', lbl: 'Matrícula' },
  { val: '10+', lbl: 'Años de experiencia' },
];

function HeroCarousel() {
  const [slide, setSlide] = useState(0);
  const propiedades = useQuery({
    queryKey: ['public-propiedades', 'hero'],
    queryFn: () => listarPropiedades({ especial: true, limit: 5 }),
  });
  const items = propiedades.data?.items ?? [];

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % items.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (propiedades.isLoading) {
    return <div className="hero-carousel loadstate" style={{ color: 'rgba(237,236,234,.7)' }}>Cargando propiedades…</div>;
  }
  if (items.length === 0) return null;

  const cur = Math.min(slide, items.length - 1);

  return (
    <div className="hero-carousel">
      {items.map((p, i) => {
        const foto = p.fotos[0];
        const precio = p.modalidad === 'VENTA' ? formatPrecio(p.precio, p.moneda) : `${formatMoney(p.montoAlquilerVigente)}/mes`;
        const meta = specsLineDe(p) || (TIPO_LABEL[p.tipo] ?? p.tipo);
        return (
          <div className={`hero-slide${i === cur ? ' active' : ''}`} key={p.id}>
            <div className="hero-slide-bg" style={foto ? undefined : { background: gradienteFor(p.id) }}>
              {foto && <img src={`${BASE_URL}${foto.url}`} alt={p.nombre} />}
            </div>
            <div className="hero-slide-overlay" />
            <div className="hero-slide-copy">
              <div className="hero-slide-meta">{meta}</div>
              <h2 className="hero-slide-title">{p.nombre}</h2>
              <p className="hero-slide-addr">{p.direccion}</p>
              <div className="hero-slide-price">{precio}</div>
            </div>
          </div>
        );
      })}

      {items.length > 1 && (
        <>
          <div className="hero-carousel-controls">
            <button
              type="button"
              className="hero-carousel-arrow"
              onClick={() => setSlide((s) => (s - 1 + items.length) % items.length)}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="hero-carousel-arrow"
              onClick={() => setSlide((s) => (s + 1) % items.length)}
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
          <div className="hero-carousel-dots">
            {items.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={i === cur ? 'active' : ''}
                onClick={() => setSlide(i)}
                aria-label={`Ver ${p.nombre}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Hero() {
  const navigate = useNavigate();
  const [modalidad, setModalidad] = useState<ModalidadPropiedad>('VENTA');
  const [tipo, setTipo] = useState<TipoPropiedad | ''>('');
  const bgParallax = useParallax<HTMLImageElement>(0.15);
  const textParallax = useParallax<HTMLDivElement>(-0.08);

  function buscar() {
    const q = new URLSearchParams({ modalidad });
    if (tipo) q.set('tipo', tipo);
    navigate(`/propiedades?${q.toString()}`);
  }

  function scrollToProps() {
    const el = document.getElementById('propiedades');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }

  return (
    <section id="inicio" className="hero">
      <div className="hero-top">
        <div className="hero-top-bg">
          <img src={fondoHero} alt="Oficina de Facundo Paris Propiedades" ref={bgParallax} className="parallax-el" />
        </div>
        <div className="hero-top-overlay" />
        <div className="container hero-top-inner parallax-el" ref={textParallax}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            <span>Martillero y Corredor Público · Mat. 1826</span>
          </div>
          <h1 className="hero-title">
            Encontrá el lugar donde <em>querés vivir</em>.
          </h1>
          <p className="hero-sub">
            Compra, venta, alquileres, tasaciones y administración de propiedades en Tandil.
          </p>
          <div className="hero-cta-row">
            <button type="button" className="btn btn-primary" onClick={scrollToProps}>
              VER PROPIEDADES
            </button>
            <a href="#contacto" className="btn btn-outline">
              QUIERO TASAR MI PROPIEDAD
            </a>
          </div>
        </div>
      </div>

      <div className="hero-stats-wrap">
        <div className="container">
          <div className="hero-stats-card">
            {HERO_STATS.map((s) => (
              <div className="hero-stat" key={s.lbl}>
                <span className="hero-stat-val">{s.val}</span>
                <span className="hero-stat-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-bottom">
        <div className="container">
          <HeroCarousel />

          <div className="search-card">
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
      </div>
    </section>
  );
}
