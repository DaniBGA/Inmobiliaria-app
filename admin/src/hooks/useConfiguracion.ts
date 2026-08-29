import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// `Configuracion` es una fila singleton que casi no cambia (se edita a
// mano desde la pantalla de Configuración, que ya invalida
// `['configuracion']` en cada guardado — ver ConfiguracionPage.tsx). Antes
// este mismo `useQuery` estaba copy-pasteado en 8 lugares del panel, sin
// `staleTime` (default 0 = "stale al instante"), así que cualquier
// pantalla que se montara pedía la fila de nuevo aunque ya estuviera
// fresca. `staleTime` alto es seguro acá porque la única forma en que el
// dato cambia (guardar en Configuración) ya invalida el caché a mano.
//
// Genérico en `T` porque cada pantalla declara su propia interfaz
// `Configuracion` local con solo los campos que usa (convención del
// proyecto, ver docs/CLAUDE.md — los tipos del frontend no se generan del
// backend) — este hook no fuerza una forma única, cada caller sigue
// pasando su propio tipo: `useConfiguracion<Configuracion>()`.
export function useConfiguracion<T = unknown>() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<T>('/configuracion'),
    staleTime: 5 * 60_000,
  });
}
