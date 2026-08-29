import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContactoInfo } from '../../hooks/useContactoInfo';
import { waLink } from '../../lib/format';
import logo from '../../logos/LOGO PNG.-02.png';

const NAV_LINKS = [
  { href: '/#inicio', label: 'Inicio' },
  { href: '/#propiedades', label: 'Propiedades' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/#contacto', label: 'Contacto' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const contactoInfo = useContactoInfo();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const c = contactoInfo.data;

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
          {c?.instagramUrl && (
            <a
              className="header-social"
              href={c.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5.5"></rect>
                <circle cx="12" cy="12" r="4.2"></circle>
                <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"></circle>
              </svg>
            </a>
          )}
          {c?.whatsapp && (
            <a
              className="header-wa"
              href={waLink(c.whatsapp, 'Hola! Quiero más información sobre sus propiedades.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="header-wa-dot" />
              Consultar
            </a>
          )}
          <button
            type="button"
            className="hamburger-btn"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span style={menuOpen ? { transform: 'translateY(7px) rotate(45deg)' } : undefined} />
            <span style={menuOpen ? { opacity: 0 } : undefined} />
            <span style={menuOpen ? { transform: 'translateY(-7px) rotate(-45deg)' } : undefined} />
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
          {c?.whatsapp && (
            <a
              className="mobile-wa"
              href={waLink(c.whatsapp, 'Hola! Quiero más información sobre sus propiedades.')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar por WhatsApp →
            </a>
          )}
        </div>
      )}
    </header>
  );
}
