import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Hero } from '../components/home/Hero';
import { PropiedadesCarousel } from '../components/home/PropiedadesCarousel';
import { TipoStatsBand } from '../components/home/TipoStatsBand';
import { ComoTrabajamos } from '../components/home/ComoTrabajamos';
import { Nosotros } from '../components/home/Nosotros';
import { ConsejosBand } from '../components/home/ConsejosBand';
import { ContactoForm } from '../components/home/ContactoForm';

export function HomePage() {
  useDocumentTitle('Facundo Paris Propiedades — Inmobiliaria en Tandil');

  return (
    <main>
      <Hero />
      <PropiedadesCarousel />
      <TipoStatsBand />
      <ComoTrabajamos />
      <Nosotros />
      <ConsejosBand />
      <ContactoForm />
    </main>
  );
}
