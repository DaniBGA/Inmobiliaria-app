import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import logo from '../../logos/LOGO PNG.-02.png';

const NAV_LINKS = [
  { href: '/#inicio', label: 'Inicio' },
  { href: '/#propiedades', label: 'Propiedades' },
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#contacto', label: 'Contacto' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const telefono = contactoInfo.data?.telefono;

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="container site-header-inner">
        <Link to="/" className="brand-logo">
          <img src={logo} alt="Facundo Paris Propiedades" />
        </Link>

        <nav className="site-nav">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="site-header-actions">
          {telefono && (
            <a className="header-phone" href={`tel:${telefono.replace(/\s+/g, '')}`}>
              {telefono}
            </a>
          )}
          <button
            type="button"
            className="hamburger-btn"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-nav">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          {telefono && <a href={`tel:${telefono.replace(/\s+/g, '')}`}>{telefono}</a>}
        </div>
      )}
    </header>
  );
}
