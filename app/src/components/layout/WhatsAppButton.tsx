import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../../api/configuracionPublica';
import { waLink } from '../../lib/format';

export function WhatsAppButton() {
  const contactoInfo = useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });
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
