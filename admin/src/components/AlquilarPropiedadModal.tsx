import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { Modal } from './Modal';

type IndiceAjuste = '' | 'IPC' | 'ICL';

export interface PropiedadParaAlquilar {
  id: string;
  nombre: string;
  direccion: string;
  modalidad: 'ALQUILER' | 'VENTA';
}

// Toma una propiedad que ya existe en la base (hoy en Venta, o en Alquiler
// pero vacante) y la pasa a modalidad Alquiler + le carga el contrato y el
// inquilino — usado tanto desde Ventas y Carteles ("+ Alquilar propiedad
// existente") como desde Inquilinos y Cobros ("+ Agregar inquilino"), porque
// en el fondo es la misma operación: instrumentar un alquiler sobre una
// propiedad de la cartera.
export function AlquilarPropiedadModal({
  propiedades,
  onClose,
  onSaved,
}: {
  propiedades: PropiedadParaAlquilar[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [propiedadId, setPropiedadId] = useState('');
  const [indice, setIndice] = useState<IndiceAjuste>('');
  const [frecuenciaAumentoMeses, setFrecuenciaAumentoMeses] = useState('');
  const [montoAlquilerInicial, setMontoAlquilerInicial] = useState('');
  const [fechaAlquilerInicial, setFechaAlquilerInicial] = useState(new Date().toISOString().slice(0, 10));
  const [contratoInicio, setContratoInicio] = useState('');
  const [contratoFin, setContratoFin] = useState('');
  const [inqNombre, setInqNombre] = useState('');
  const [inqTelefono, setInqTelefono] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const propiedadElegida = propiedades.find((p) => p.id === propiedadId);

  const guardar = useMutation({
    mutationFn: async () => {
      await api.patch(`/propiedades/${propiedadId}`, {
        modalidad: 'ALQUILER',
        indice: indice || undefined,
        frecuenciaAumentoMeses: frecuenciaAumentoMeses ? Number(frecuenciaAumentoMeses) : undefined,
        contratoInicio: contratoInicio || undefined,
        contratoFin: contratoFin || undefined,
      });
      await api.post(`/propiedades/${propiedadId}/aumentos`, {
        fecha: fechaAlquilerInicial,
        monto: Number(montoAlquilerInicial),
      });
      return api.patch(`/propiedades/${propiedadId}/inquilino`, {
        nombre: inqNombre.trim(),
        telefono: inqTelefono || undefined,
        email: inqEmail || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['cobros'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
      qc.invalidateQueries({ queryKey: ['carteles'] });
      onSaved();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo alquilar la propiedad.'),
  });

  const puedeGuardar = !!propiedadId && !!montoAlquilerInicial && !!inqNombre.trim();

  return (
    <Modal open onClose={onClose} title="Alquilar propiedad existente">
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Propiedad</label>
          <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
            <option value="">— Elegir de la cartera —</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.direccion} ({p.modalidad === 'VENTA' ? 'hoy en venta' : 'vacante'})
              </option>
            ))}
          </select>
          {propiedades.length === 0 && (
            <div className="hint" style={{ marginTop: 6 }}>
              Todas las propiedades de la cartera ya tienen un inquilino asignado.
            </div>
          )}
        </div>
        <div className="fg">
          <label>Índice de ajuste</label>
          <select value={indice} onChange={(e) => setIndice(e.target.value as IndiceAjuste)}>
            <option value="">— Sin definir —</option>
            <option value="IPC">IPC</option>
            <option value="ICL">ICL</option>
          </select>
        </div>
        <div className="fg">
          <label>Frecuencia de aumento</label>
          <div className="suffix">
            <input
              type="number"
              min={1}
              value={frecuenciaAumentoMeses}
              onChange={(e) => setFrecuenciaAumentoMeses(e.target.value)}
            />
            <span>meses</span>
          </div>
        </div>
        <div className="fg">
          <label>Monto de alquiler inicial</label>
          <div className="suffix">
            <input
              type="number"
              min={0}
              value={montoAlquilerInicial}
              onChange={(e) => setMontoAlquilerInicial(e.target.value)}
            />
            <span>$</span>
          </div>
        </div>
        <div className="fg">
          <label>Vigente desde</label>
          <input type="date" value={fechaAlquilerInicial} onChange={(e) => setFechaAlquilerInicial(e.target.value)} />
        </div>
        <div className="fg">
          <label>Contrato — inicio</label>
          <input type="date" value={contratoInicio} onChange={(e) => setContratoInicio(e.target.value)} />
        </div>
        <div className="fg">
          <label>Contrato — fin</label>
          <input type="date" value={contratoFin} onChange={(e) => setContratoFin(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Nombre del inquilino</label>
          <input value={inqNombre} onChange={(e) => setInqNombre(e.target.value)} placeholder="Nombre y apellido" />
        </div>
        <div className="fg">
          <label>Teléfono</label>
          <input value={inqTelefono} onChange={(e) => setInqTelefono(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Email</label>
          <input type="email" value={inqEmail} onChange={(e) => setInqEmail(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      {propiedadElegida?.modalidad === 'VENTA' && (
        <div className="cfgnote" style={{ marginTop: 4 }}>
          <i>△</i>
          <span>
            Esta propiedad está publicada en venta — al alquilarla pasa a modalidad "Alquiler" y deja de listarse en
            Ventas y Carteles como publicada. Si tiene ficha de venta con interesados, no se borra, pero conviene
            coordinarlo antes de este paso.
          </span>
        </div>
      )}
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={!puedeGuardar || guardar.isPending} onClick={() => guardar.mutate()}>
          Alquilar propiedad
        </button>
      </div>
    </Modal>
  );
}
