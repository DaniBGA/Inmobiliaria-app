import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { AgregarPropiedadPage } from './pages/AgregarPropiedadPage';
import { InquilinosPage } from './pages/InquilinosPage';
import { PropietariosPage } from './pages/PropietariosPage';
import { VentasPage } from './pages/VentasPage';
import { CajaPage } from './pages/CajaPage';
import { IncidenciasPage } from './pages/IncidenciasPage';
import { ClientesPage } from './pages/ClientesPage';
import { AgendaPage } from './pages/AgendaPage';
import { AvisosPage } from './pages/AvisosPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}

export default function App() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="loadstate">Cargando…</div>;
  }

  if (!usuario) {
    return <LoginPage />;
  }

  // Un designado (rol EQUIPO) solo puede ver "Ventas y Carteles",
  // "Clientes" (pedido del usuario 2026-09-04: los que el admin le designa,
  // más los que crea él mismo) y "Agenda" — el resto de las páginas
  // dependen de endpoints que ahora devuelven 403 para ese rol (ver el
  // gating agregado en los controllers del backend), así que ni siquiera
  // tiene sentido renderizarlas.
  const esEquipo = usuario.rol === 'EQUIPO';
  const soloAdmin = (el: JSX.Element) => (esEquipo ? <Navigate to="/ventas" replace /> : el);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={soloAdmin(<DashboardPage />)} />
        <Route path="/propiedades/nueva" element={soloAdmin(<AgregarPropiedadPage />)} />
        <Route path="/inquilinos" element={soloAdmin(<InquilinosPage />)} />
        <Route path="/propietarios" element={soloAdmin(<PropietariosPage />)} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/caja" element={soloAdmin(<CajaPage />)} />
        <Route path="/incidencias" element={soloAdmin(<IncidenciasPage />)} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/avisos" element={soloAdmin(<AvisosPage />)} />
        <Route path="/configuracion" element={soloAdmin(<ConfiguracionPage />)} />
        <Route path="*" element={<Navigate to={esEquipo ? '/ventas' : '/'} replace />} />
      </Routes>
    </Layout>
  );
}
