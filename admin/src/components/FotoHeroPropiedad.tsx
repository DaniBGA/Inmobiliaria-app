import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError, BASE_URL } from '../api/client';

// Imagen de portada del carrusel destacado del Hero de la landing — un
// campo propio (Propiedad.heroPortadaUrl), separado de la galería de fotos
// de la propiedad (FotosPropiedad, recortada 4:5 para las tarjetas). Solo
// tiene sentido para propiedades de "carácter especial". Se sube y se
// reemplaza al toque (no hace falta "Guardar cambios"), igual que la foto
// de "Nosotros" en Configuración.
export function FotoHeroPropiedad({
  propiedadId,
  heroPortadaUrl,
  onChange,
}: {
  propiedadId: string;
  heroPortadaUrl: string | null;
  onChange: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const subir = useMutation({
    mutationFn: (archivo: File) => {
      const form = new FormData();
      form.append('archivo', archivo);
      return api.upload(`/propiedades/${propiedadId}/hero`, form);
    },
    onSuccess: onChange,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/propiedades/${propiedadId}/hero`),
    onSuccess: onChange,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo quitar la imagen.'),
  });

  function confirmarEliminar() {
    if (window.confirm('¿Quitar la imagen de portada del carrusel? Esta acción no se puede deshacer.')) {
      eliminar.mutate();
    }
  }

  return (
    <div>
      {error && <div className="errstate" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {heroPortadaUrl && (
          <img
            src={`${BASE_URL}${heroPortadaUrl}`}
            alt=""
            style={{ width: 96, height: 54, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }}
          />
        )}
        <label className="dropzone" style={{ flex: 1, margin: 0 }}>
          {subir.isPending ? 'Subiendo…' : heroPortadaUrl ? 'Cambiar imagen de portada' : 'Hacé clic para elegir la imagen de portada (JPG, PNG o WEBP)'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={subir.isPending}
            style={{ display: 'none' }}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subir.mutate(archivo);
              e.target.value = '';
            }}
          />
        </label>
        {heroPortadaUrl && (
          <button type="button" className="btn-ghost" disabled={eliminar.isPending} onClick={confirmarEliminar}>
            Quitar
          </button>
        )}
      </div>
      <div className="hint" style={{ marginTop: 10 }}>
        📐 Dimensiones recomendadas: <b>1800 × 1050 px</b> aprox. Es la imagen que llena el 75% del ancho del
        carrusel destacado de la landing (el resto queda en degradado azul) — con esa proporción el recorte para
        llenar el espacio es mínimo.
      </div>
    </div>
  );
}
