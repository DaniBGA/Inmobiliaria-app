import { Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { WhatsAppButton } from './components/layout/WhatsAppButton';
import { Splash } from './components/layout/Splash';
import { HomePage } from './pages/HomePage';
import { PropiedadesPage } from './pages/PropiedadesPage';

export default function App() {
  return (
    <>
      <Splash />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/propiedades" element={<PropiedadesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
