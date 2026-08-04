import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError, BASE_URL } from '../api/client';

export interface FotoPropiedadItem {
  id: string;
  url: string;
  orden: number;
  esPortada?: boolean;
}

// Compartido entre la ficha de alquiler (PropiedadFichaDrawer) y la ficha de
// venta (VentasPage/SaleModal) — agregar/quitar fotos es la misma operación
// en los dos casos, solo cambia desde dónde se abre.
export function FotosPropiedad({
  propiedadId,
  fotos,
  mostrarPortada = false,
  onChange,
}: {
  propiedadId: string;
  fotos: FotoPropiedadItem[];
  // Solo tiene sentido elegir portada si la propiedad es "carácter
  // especial" (la usa el carrusel destacado del Hero) y hay más de una
  // foto entre las que elegir — con una sola foto no hay nada que decidir.
  mostrarPortada?: boolean;
  onChange: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: (fotoId: string) => api.delete(`/propiedades/${propiedadId}/fotos/${fotoId}`),
    onSuccess: onChange,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto.'),
  });

  const marcarPortada = useMutation({
    mutationFn: (fotoId: string) => api.patch(`/propiedades/${propiedadId}/fotos/${fotoId}/portada`),
    onSuccess: onChange,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo marcar la portada.'),
  });

  async function subirArchivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const fallidas: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append('archivo', file);
        await api.upload(`/propiedades/${propiedadId}/fotos`, form);
      } catch (err) {
        const motivo = err instanceof ApiError ? err.message : 'error desconocido';
        fallidas.push(`${file.name} (${motivo})`);
      }
    }
    setSubiendo(false);
    if (fallidas.length > 0) {
      setError(`No se ${fallidas.length === 1 ? 'pudo subir' : 'pudieron subir'}: ${fallidas.join('; ')}.`);
    }
    onChange();
  }

  function confirmarEliminar(fotoId: string) {
    if (window.confirm('¿Eliminar esta foto? Esta acción no se puede deshacer.')) {
      eliminar.mutate(fotoId);
    }
  }

  return (
    <div>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <label className="dropzone">
        {subiendo ? 'Subiendo…' : 'Hacé clic para elegir fotos (JPG, PNG o WEBP)'}
        <small>Podés elegir varias a la vez</small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={subiendo}
          style={{ display: 'none' }}
          onChange={(e) => {
            subirArchivos(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {mostrarPortada && fotos.length > 1 && (
        <div className="hint" style={{ marginTop: 10 }}>
          ★ Marcá con la estrella qué foto se usa en el carrusel destacado de la landing (por defecto se usa la primera).
        </div>
      )}
      {fotos.length > 0 ? (
        <div className="fotogrid">
          {fotos.map((f) => (
            <div className="fotothumb" key={f.id}>
              <img src={`${BASE_URL}${f.url}`} alt="" />
              {mostrarPortada && fotos.length > 1 && (
                <button
                  type="button"
                  className={`portada${f.esPortada ? ' activa' : ''}`}
                  title={f.esPortada ? 'Portada del carrusel destacado' : 'Usar como portada del carrusel destacado'}
                  disabled={marcarPortada.isPending}
                  onClick={() => marcarPortada.mutate(f.id)}
                >
                  ★
                </button>
              )}
              <button
                type="button"
                className="quitar"
                title="Eliminar esta foto"
                disabled={eliminar.isPending}
                onClick={() => confirmarEliminar(f.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 10 }}>
          Todavía no hay fotos cargadas.
        </div>
      )}
    </div>
  );
}
