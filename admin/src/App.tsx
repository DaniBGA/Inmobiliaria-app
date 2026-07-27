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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/propiedades/nueva" element={<AgregarPropiedadPage />} />
        <Route path="/inquilinos" element={<InquilinosPage />} />
        <Route path="/propietarios" element={<PropietariosPage />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/incidencias" element={<IncidenciasPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/avisos" element={<AvisosPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
