import { useQuery } from '@tanstack/react-query';
import { fetchContactoInfo } from '../api/configuracionPublica';

// Mismo `useQuery` (queryKey/queryFn/staleTime) estaba copy-pasteado en 8
// componentes de la landing (Header, Footer, WhatsAppButton, Nosotros,
// ContactoForm, ComoTrabajamos, ConsejosBand, PropertyCard) — un solo
// lugar para no tener que acordarse de tocar los 8 si cambia el
// `staleTime` o la queryFn. React Query igual dedupea la llamada de red
// real por `queryKey` compartida, así que esto no cambia comportamiento,
// solo mantenibilidad.
export function useContactoInfo() {
  return useQuery({
    queryKey: ['contacto-info'],
    queryFn: fetchContactoInfo,
    staleTime: 5 * 60_000,
  });
}
