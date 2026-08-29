import { useContactoInfo } from '../../hooks/useContactoInfo';
import { waLink } from '../../lib/format';

export function WhatsAppButton() {
  const contactoInfo = useContactoInfo();
  const whatsapp = contactoInfo.data?.whatsapp;
  if (!whatsapp) return null;

  return (
    <a
      className="whatsapp-float"
      href={waLink(whatsapp, 'Hola! Quiero más información sobre sus propiedades.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
    >
      WA
    </a>
  );
}
