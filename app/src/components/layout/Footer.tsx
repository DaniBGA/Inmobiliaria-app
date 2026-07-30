import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { waLink } from '../../lib/format';
import logo from '../../logos/LOGO PNG.-02.png';

export function Footer() {
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });
  const c = contactoInfo.data;
  const anio = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="footer-brand">
          <img src={logo} alt="Facundo Paris Propiedades" />
          <p>
            Más de una década acompañando a familias e inversores de Tandil en la compra, venta y alquiler de
            propiedades.
          </p>
          <div className="footer-social-row">
            {c?.instagramUrl && (
              <a href={c.instagramUrl} target="_blank" rel="noopener noreferrer" className="footer-social">
                Instagram
              </a>
            )}
            {c?.whatsapp && (
              <a
                href={waLink(c.whatsapp, 'Hola! Quiero más información sobre sus propiedades.')}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="footer-col">
          <h4>Contacto</h4>
          {c?.direccion && <p>{c.direccion}</p>}
          {c?.telefono && <p>{c.telefono}</p>}
          {c?.email && <p>{c.email}</p>}
          {c?.matricula && <p>Matrícula {c.matricula}</p>}
        </div>

        <div className="footer-col">
          <h4>Navegación</h4>
          <a href="/#inicio">Inicio</a>
          <a href="/#propiedades">Propiedades</a>
          <a href="/#nosotros">Nosotros</a>
          <a href="/#contacto">Contacto</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {anio} Facundo Paris Propiedades. Todos los derechos reservados.</span>
        <span>Tandil, Buenos Aires</span>
      </div>
    </footer>
  );
}
