import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { Modal } from './Modal';

type IndiceAjuste = '' | 'IPC' | 'ICL';
type PunitorioFrecuencia = '' | 'DIA' | 'SEMANA' | 'MES' | 'UNICO';
type PunitorioTipo = '' | 'MONTO_FIJO' | 'PORCENTAJE';

export interface PropiedadParaAlquilar {
  id: string;
  nombre: string;
  direccion: string;
  modalidad: 'ALQUILER' | 'VENTA';
}

// Toma una propiedad de la cartera que ya está en modalidad Alquiler pero
// vacante y le carga el contrato — usado desde Inquilinos y Cobros, tanto
// para instrumentar un alquiler ya ocupado ("+ Agregar inquilino") como
// para publicar una propiedad de alquiler todavía vacante (sin tildar "Ya
// tiene inquilino asignado"), porque en el fondo es la misma operación
// sobre una propiedad de la cartera.
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
  const [contratoInicio, setContratoInicio] = useState('');
  const [contratoFin, setContratoFin] = useState('');
  const [punitorioFrecuencia, setPunitorioFrecuencia] = useState<PunitorioFrecuencia>('DIA');
  const [punitorioTipo, setPunitorioTipo] = useState<PunitorioTipo>('');
  const [punitorioValor, setPunitorioValor] = useState('');
  const [tieneInquilino, setTieneInquilino] = useState(true);
  const [alquilerPublicado, setAlquilerPublicado] = useState(true);
  const [inqNombre, setInqNombre] = useState('');
  const [inqTelefono, setInqTelefono] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  // El inquilino ya alquilaba desde antes de entrar al sistema y pagaba por
  // fuera: anula la deuda de los meses anteriores, se empieza a exigir el
  // pago recién desde el mes actual (ver Inquilino.alDiaDesde).
  const [alDia, setAlDia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      await api.patch(`/propiedades/${propiedadId}`, {
        modalidad: 'ALQUILER',
        indice: indice || undefined,
        frecuenciaAumentoMeses: frecuenciaAumentoMeses ? Number(frecuenciaAumentoMeses) : undefined,
        contratoInicio: contratoInicio || undefined,
        contratoFin: contratoFin || undefined,
        alquilerPublicado,
        punitorioFrecuencia: punitorioTipo && punitorioValor ? punitorioFrecuencia || undefined : undefined,
        punitorioTipo: punitorioTipo || undefined,
        punitorioValor: punitorioTipo && punitorioValor ? Number(punitorioValor) : undefined,
      });
      await api.post(`/propiedades/${propiedadId}/aumentos`, {
        fecha: contratoInicio || new Date().toISOString().slice(0, 10),
        monto: Number(montoAlquilerInicial),
      });
      if (!tieneInquilino) return;
      return api.patch(`/propiedades/${propiedadId}/inquilino`, {
        nombre: inqNombre.trim(),
        telefono: inqTelefono || undefined,
        email: inqEmail || undefined,
        alDia,
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
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la propiedad de alquiler.'),
  });

  const puedeGuardar = !!propiedadId && !!montoAlquilerInicial && (!tieneInquilino || !!inqNombre.trim());

  return (
    <Modal open onClose={onClose} title={tieneInquilino ? 'Alquilar propiedad existente' : 'Publicar propiedad de alquiler'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Propiedad</label>
          <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
            <option value="">— Elegir de la cartera —</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.direccion} (vacante)
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
              step="0.01"
              value={montoAlquilerInicial}
              onChange={(e) => setMontoAlquilerInicial(e.target.value)}
            />
            <span>$</span>
          </div>
        </div>
        <div className="fg">
          <label>Contrato — inicio</label>
          <input type="date" value={contratoInicio} onChange={(e) => setContratoInicio(e.target.value)} />
        </div>
        <div className="fg">
          <label>Contrato — fin</label>
          <input type="date" value={contratoFin} onChange={(e) => setContratoFin(e.target.value)} />
        </div>
        <div className="fg">
          <label>Mora — tipo</label>
          <select value={punitorioTipo} onChange={(e) => setPunitorioTipo(e.target.value as PunitorioTipo)}>
            <option value="">— Sin mora —</option>
            <option value="MONTO_FIJO">Monto fijo</option>
            <option value="PORCENTAJE">Porcentaje del alquiler</option>
          </select>
        </div>
        {punitorioTipo && (
          <>
            <div className="fg">
              <label>Mora — valor</label>
              <div className="suffix">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={punitorioValor}
                  onChange={(e) => setPunitorioValor(e.target.value)}
                />
                <span>{punitorioTipo === 'PORCENTAJE' ? '%' : '$'}</span>
              </div>
            </div>
            <div className="fg">
              <label>Mora — se aplica por</label>
              <select value={punitorioFrecuencia} onChange={(e) => setPunitorioFrecuencia(e.target.value as PunitorioFrecuencia)}>
                <option value="DIA">Día de atraso</option>
                <option value="SEMANA">Semana de atraso</option>
                <option value="MES">Mes de atraso</option>
                <option value="UNICO">Una sola vez</option>
              </select>
            </div>
          </>
        )}
        <div className="fg full">
          <label className="chk">
            <input type="checkbox" checked={tieneInquilino} onChange={(e) => setTieneInquilino(e.target.checked)} />
            <span>Ya tiene inquilino asignado</span>
          </label>
        </div>
        {!tieneInquilino && (
          <div className="fg full">
            <label className="chk">
              <input type="checkbox" checked={alquilerPublicado} onChange={(e) => setAlquilerPublicado(e.target.checked)} />
              <span>Mostrar en la página web (landing page)</span>
            </label>
          </div>
        )}
        {tieneInquilino && (
          <>
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
            <div className="fg full">
              <label className="chk">
                <input type="checkbox" checked={alDia} onChange={(e) => setAlDia(e.target.checked)} />
                <span>Se encuentra al día (ya alquilaba y pagaba por fuera del sistema)</span>
              </label>
            </div>
            {alDia && (
              <div className="cfgnote" style={{ marginTop: 0 }}>
                <i>△</i>
                <span>No se le va a cobrar deuda de los meses anteriores — el pago empieza a exigirse desde este mes.</span>
              </div>
            )}
          </>
        )}
      </div>
      {!tieneInquilino && (
        <div className="cfgnote" style={{ marginTop: 4 }}>
          <i>△</i>
          <span>
            Sin inquilino, la propiedad queda vacante y, si además está tildado "Mostrar en la página web", se
            publica en la landing pública. Una vez que se le asigne un inquilino, deja de aparecer en la web
            automáticamente.
          </span>
        </div>
      )}
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={!puedeGuardar || guardar.isPending} onClick={() => guardar.mutate()}>
          {tieneInquilino ? 'Alquilar propiedad' : 'Publicar propiedad'}
        </button>
      </div>
    </Modal>
  );
}
