import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import logo from '../images/logo-comprobante-membrete.png';

// Orden corregido según el documento funcional (§1): "Propietarios y
// Liquidaciones" va inmediatamente después de "Inquilinos y Cobros" — en el
// boceto original ese orden estaba distinto; el propio documento marca esto
// como el criterio a aplicar en producción, no una preferencia de diseño.
const ITEMS = [
  { to: '/', icon: '▦', label: 'Panel', badge: null },
  { to: '/propiedades/nueva', icon: '✚', label: 'Agregar Propiedad', badge: null },
  { to: '/inquilinos', icon: '◐', label: 'Inquilinos y Cobros', badge: null },
  { to: '/propietarios', icon: '◉', label: 'Propietarios y Liquidaciones', badge: null },
  { to: '/ventas', icon: '◈', label: 'Ventas y Carteles', badge: null },
  { to: '/caja', icon: '₲', label: 'Caja', badge: null },
  { to: '/incidencias', icon: '⚠', label: 'Incidencias y Proveedores', badge: 'incidencias' },
  { to: '/clientes', icon: '☏', label: 'Clientes', badge: null },
  { to: '/agenda', icon: '▥', label: 'Agenda', badge: 'agenda' },
  { to: '/avisos', icon: '✉', label: 'Avisos', badge: 'avisos' },
  { to: '/configuracion', icon: '⚙', label: 'Configuración y Reportes', badge: null },
] as const;

// Las claves llevan el dominio primero (['incidencias','badge'] en vez de
// ['badge','incidencias']) a propósito: React Query invalida por prefijo,
// así que cuando cualquier página hace
// `invalidateQueries({ queryKey: ['incidencias'] })` tras crear/resolver una
// incidencia, este badge se refresca solo — sin esa coincidencia de
// prefijo, el contador del sidebar quedaba pegado hasta que pasaban los 60s
// de staleTime o se recargaba la página entera.
function useBadges(esEquipo: boolean) {
  // Incidencias y Avisos ahora son ADMIN-only en el backend — pedirlos
  // como designado devolvería 403 en cada navegación, así que se
  // deshabilitan directamente para ese rol.
  const incidencias = useQuery({
    queryKey: ['incidencias', 'badge'],
    queryFn: () => api.get<unknown[]>('/incidencias?estado=ABIERTA'),
    staleTime: 60_000,
    enabled: !esEquipo,
  });
  const agenda = useQuery({
    queryKey: ['agenda', 'badge'],
    queryFn: () => api.get<{ manuales: { hecho: boolean }[] }>(
      `/agenda/mes/${new Date().toISOString().slice(0, 7)}`,
    ),
    staleTime: 60_000,
  });
  const avisos = useQuery({
    queryKey: ['avisos', 'badge'],
    queryFn: () => api.get<Record<string, unknown[]>>('/avisos'),
    staleTime: 60_000,
    enabled: !esEquipo,
  });

  return {
    incidencias: incidencias.data?.length ?? 0,
    agenda: agenda.data?.manuales.filter((e) => !e.hecho).length ?? 0,
    avisos: avisos.data ? Object.values(avisos.data).reduce((acc, arr) => acc + arr.length, 0) : 0,
  };
}

const ITEMS_EQUIPO = new Set(['/ventas', '/clientes', '/agenda']);

export function Sidebar() {
  const [navmin, setNavmin] = useState(false);
  const [navopen, setNavopen] = useState(false);
  const { logout, usuario } = useAuth();
  const esEquipo = usuario?.rol === 'EQUIPO';
  const badges = useBadges(esEquipo);
  const location = useLocation();
  const items = esEquipo ? ITEMS.filter((item) => ITEMS_EQUIPO.has(item.to)) : ITEMS;

  useEffect(() => {
    document.body.classList.toggle('navmin', navmin);
  }, [navmin]);

  useEffect(() => {
    document.body.classList.toggle('navopen', navopen);
  }, [navopen]);

  // En celular la sidebar es un drawer: al navegar a otra sección se cierra
  // sola, como cualquier menú lateral táctil (si no, taparía la página
  // recién abierta hasta que el usuario la cierre a mano).
  useEffect(() => {
    setNavopen(false);
  }, [location.pathname]);

  const badgeValue = (key: string | null) => {
    if (key === 'incidencias') return badges.incidencias;
    if (key === 'agenda') return badges.agenda;
    if (key === 'avisos') return badges.avisos;
    return 0;
  };

  return (
    <>
      <button
        className="navtoggle"
        title="Achicar / expandir panel"
        onClick={() => setNavmin((v) => !v)}
      >
        {navmin ? '›' : '‹'}
      </button>
      <button
        className="hamburger"
        title="Abrir / cerrar menú"
        aria-label="Abrir / cerrar menú"
        onClick={() => setNavopen((v) => !v)}
      >
        {navopen ? '✕' : '☰'}
      </button>
      <div className={`navoverlay${navopen ? ' on' : ''}`} onClick={() => setNavopen(false)}></div>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" style={{ background: '#fff', overflow: 'hidden', alignItems: 'center', width: 'auto', height: 'auto', padding: '4px 10px' }}>
            <img src={logo} alt="Facundo Paris Propiedades" style={{ width: 'auto', height: 40, display: 'block', margin: '0 auto' }} />
          </div>
        </div>
        <nav>
          {items.map((item) => {
            const n = badgeValue(item.badge);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <span className="ico">{item.icon}</span>
                <span className="lbl">{item.label}</span>
                {item.badge && (
                  <span className={`navbadge${n > 0 ? ' on' : ''}`}>{n}</span>
                )}
              </NavLink>
            );
          })}
          <button className="navlogout" title="Cerrar sesión" onClick={logout}>
            <span className="ico">⇥</span>
            <span className="lbl">Cerrar sesión</span>
          </button>
        </nav>
        <div className="ver">
          <b>PRODUCCIÓN</b>
          <span>InmoGest v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
