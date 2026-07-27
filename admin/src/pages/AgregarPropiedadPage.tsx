import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';

type Modalidad = 'ALQUILER' | 'VENTA';
type TipoHonorarios = '' | 'LIBRE' | 'TRES_POR_CIENTO' | 'SEIS_POR_CIENTO' | 'OTRO';
type IndiceAjuste = '' | 'IPC' | 'ICL';
type Moneda = 'ARS' | 'USD';

interface Propietario {
  id: string;
  nombre: string;
}
interface Delegado {
  id: string;
  nombre: string;
}

const TIPO_LABEL: Record<string, string> = {
  CASA: 'Casa',
  DEPARTAMENTO_DUPLEX: 'Departamento/Dúplex',
  QUINTA: 'Quinta',
  LOTE: 'Lote',
  CAMPO: 'Campo',
  GALPON: 'Galpón',
  LOCAL_OFICINA: 'Local/Oficina',
  CABANIAS_HOTELES_OTROS: 'Cabañas/Hoteles/Otros',
  FONDO_DE_COMERCIO: 'Fondo de comercio',
  COCHERAS: 'Cocheras',
};

export function AgregarPropiedadPage() {
  const qc = useQueryClient();

  const propietarios = useQuery({
    queryKey: ['propietarios'],
    queryFn: () => api.get<Propietario[]>('/propietarios'),
  });
  const delegados = useQuery({
    queryKey: ['integrantes-equipo'],
    queryFn: () => api.get<Delegado[]>('/integrantes-equipo'),
  });

  // Datos generales
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipo, setTipo] = useState('CASA');
  const [modalidad, setModalidad] = useState<Modalidad>('ALQUILER');
  const [propietarioId, setPropietarioId] = useState('');
  const [propietarioNuevoNombre, setPropietarioNuevoNombre] = useState('');
  const [designadoId, setDesignadoId] = useState('');
  const [honorariosTipo, setHonorariosTipo] = useState<TipoHonorarios>('');
  const [honorariosPorcentaje, setHonorariosPorcentaje] = useState('');
  const [ambientes, setAmbientes] = useState('');
  const [banos, setBanos] = useState('');
  const [superficieM2, setSuperficieM2] = useState('');

  // Alquiler
  const [indice, setIndice] = useState<IndiceAjuste>('');
  const [frecuenciaAumentoMeses, setFrecuenciaAumentoMeses] = useState('');
  const [montoAlquilerInicial, setMontoAlquilerInicial] = useState('');
  const [fechaAlquilerInicial, setFechaAlquilerInicial] = useState('');
  const [contratoInicio, setContratoInicio] = useState('');
  const [contratoFin, setContratoFin] = useState('');
  const [tieneInquilino, setTieneInquilino] = useState(false);
  const [inqNombre, setInqNombre] = useState('');
  const [inqTelefono, setInqTelefono] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  const [alquilerPublicado, setAlquilerPublicado] = useState(true);

  // Venta
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [publicada, setPublicada] = useState(true);
  const [cierreEstimado, setCierreEstimado] = useState('');
  const [imagenes, setImagenes] = useState<{ file: File; preview: string }[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ nombre: string; modalidad: Modalidad; fotosFallidas: string[] } | null>(null);

  function agregarImagenes(files: FileList | null) {
    if (!files) return;
    const nuevas = Array.from(files).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setImagenes((prev) => [...prev, ...nuevas]);
  }

  function quitarImagen(idx: number) {
    setImagenes((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function limpiarFormulario() {
    setNombre('');
    setDireccion('');
    setTipo('CASA');
    setModalidad('ALQUILER');
    setPropietarioId('');
    setPropietarioNuevoNombre('');
    setDesignadoId('');
    setHonorariosTipo('');
    setHonorariosPorcentaje('');
    setAmbientes('');
    setBanos('');
    setSuperficieM2('');
    setIndice('');
    setFrecuenciaAumentoMeses('');
    setMontoAlquilerInicial('');
    setFechaAlquilerInicial('');
    setContratoInicio('');
    setContratoFin('');
    setTieneInquilino(false);
    setInqNombre('');
    setInqTelefono('');
    setInqEmail('');
    setAlquilerPublicado(true);
    setPrecio('');
    setMoneda('USD');
    setPublicada(true);
    setCierreEstimado('');
    imagenes.forEach((img) => URL.revokeObjectURL(img.preview));
    setImagenes([]);
  }

  const crear = useMutation({
    mutationFn: async () => {
      let propId = propietarioId;
      if (!propId && propietarioNuevoNombre.trim()) {
        const nuevo = await api.post<Propietario>('/propietarios', { nombre: propietarioNuevoNombre.trim() });
        propId = nuevo.id;
      }

      const propiedad = await api.post<{ id: string }>('/propiedades', {
        nombre,
        direccion,
        tipo,
        modalidad,
        propietarioId: propId || undefined,
        designadoId: designadoId || undefined,
        honorariosTipo: honorariosTipo || undefined,
        honorariosPorcentaje: honorariosTipo === 'OTRO' && honorariosPorcentaje ? Number(honorariosPorcentaje) : undefined,
        ambientes: ambientes ? Number(ambientes) : undefined,
        banos: banos ? Number(banos) : undefined,
        superficieM2: superficieM2 ? Number(superficieM2) : undefined,
        indice: modalidad === 'ALQUILER' && indice ? indice : undefined,
        frecuenciaAumentoMeses: modalidad === 'ALQUILER' && frecuenciaAumentoMeses ? Number(frecuenciaAumentoMeses) : undefined,
        montoAlquilerInicial: modalidad === 'ALQUILER' && montoAlquilerInicial ? Number(montoAlquilerInicial) : undefined,
        fechaAlquilerInicial: modalidad === 'ALQUILER' && fechaAlquilerInicial ? fechaAlquilerInicial : undefined,
        contratoInicio: modalidad === 'ALQUILER' && contratoInicio ? contratoInicio : undefined,
        contratoFin: modalidad === 'ALQUILER' && contratoFin ? contratoFin : undefined,
        alquilerPublicado: modalidad === 'ALQUILER' ? alquilerPublicado : undefined,
      });

      if (modalidad === 'ALQUILER' && tieneInquilino && inqNombre.trim()) {
        await api.patch(`/propiedades/${propiedad.id}/inquilino`, {
          nombre: inqNombre.trim(),
          telefono: inqTelefono || undefined,
          email: inqEmail || undefined,
        });
      }

      if (modalidad === 'VENTA' && precio) {
        await api.post(`/propiedades/${propiedad.id}/venta`, {
          precio: Number(precio),
          moneda,
          publicada,
          cierreEstimado: cierreEstimado || undefined,
        });
      }

      // Se suben una por una (no en paralelo) para que el orden de la
      // galería quede igual al orden en que se eligieron, y para no tirar
      // toda la carga abajo si una sola foto falla — la propiedad y la
      // venta ya están guardadas en este punto, así que una foto que no
      // sube no debería aparentar que se perdió todo lo demás.
      const fotosFallidas: string[] = [];
      for (const { file } of imagenes) {
        try {
          const form = new FormData();
          form.append('archivo', file);
          await api.upload(`/propiedades/${propiedad.id}/fotos`, form);
        } catch {
          fotosFallidas.push(file.name);
        }
      }

      return { propiedad, fotosFallidas };
    },
    onSuccess: ({ fotosFallidas }) => {
      setError(null);
      setExito({ nombre, modalidad, fotosFallidas });
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['propietarios'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
      qc.invalidateQueries({ queryKey: ['carteles'] });
      qc.invalidateQueries({ queryKey: ['cobros'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
      limpiarFormulario();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la propiedad.'),
  });

  const puedeGuardar =
    nombre.trim() &&
    direccion.trim() &&
    (propietarioId || propietarioNuevoNombre.trim()) &&
    (modalidad === 'ALQUILER' || (modalidad === 'VENTA' && precio));

  return (
    <>
      <PageHeader title="Agregar Propiedad" />
      <main>
        <div className="notice">
          <div className="ico">⌂</div>
          <div>
            <b>Nueva propiedad para el catálogo</b>
            <p>
              Cargá una propiedad para alquilar o vender. Si la modalidad es "Venta" y la marcás como publicada, queda
              lista para mostrarse en la página web pública apenas esté conectada al mismo catálogo. Las propiedades
              de alquiler sin inquilino también se consideran "disponibles para publicar".
            </p>
          </div>
        </div>

        {exito && (
          <div className="okstate" style={{ marginBottom: 22 }}>
            <div className="big">✓</div>
            <h4>"{exito.nombre}" se cargó correctamente</h4>
            <p>
              Podés seguir cargando propiedades, o ir a{' '}
              <Link to="/propietarios">Propietarios y Liquidaciones</Link>
              {exito.modalidad === 'VENTA' && (
                <>
                  {' '}
                  o a <Link to="/ventas">Ventas y Carteles</Link>
                </>
              )}{' '}
              para verla.
            </p>
            {exito.fotosFallidas.length > 0 && (
              <p style={{ color: 'var(--red)', marginTop: 6 }}>
                No se pudieron subir {exito.fotosFallidas.length === 1 ? 'esta foto' : 'estas fotos'}:{' '}
                {exito.fotosFallidas.join(', ')}. El resto de la propiedad se guardó bien.
              </p>
            )}
          </div>
        )}
        {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="cfggrid">
          <div className="cfgcard">
            <h3>DATOS GENERALES</h3>
            <div className="hint">Nombre, dirección, tipo y a quién pertenece.</div>
            <div className="cfgfields">
              <div className="fg full">
                <label>Nombre de la propiedad</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Depto Callao 500" />
              </div>
              <div className="fg full">
                <label>Dirección</label>
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle y número, ciudad" />
              </div>
              <div className="fg">
                <label>Tipo de propiedad</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Modalidad</label>
                <select value={modalidad} onChange={(e) => setModalidad(e.target.value as Modalidad)}>
                  <option value="ALQUILER">Alquiler</option>
                  <option value="VENTA">Venta</option>
                </select>
              </div>
              <div className="fg">
                <label>Propietario</label>
                <select
                  value={propietarioId}
                  onChange={(e) => {
                    setPropietarioId(e.target.value);
                    if (e.target.value) setPropietarioNuevoNombre('');
                  }}
                >
                  <option value="">— Elegir de la lista —</option>
                  {(propietarios.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>O propietario nuevo</label>
                <input
                  value={propietarioNuevoNombre}
                  onChange={(e) => {
                    setPropietarioNuevoNombre(e.target.value);
                    if (e.target.value) setPropietarioId('');
                  }}
                  placeholder="Nombre y apellido"
                  disabled={!!propietarioId}
                />
              </div>
              <div className="fg">
                <label>Designado para mostrar</label>
                <select value={designadoId} onChange={(e) => setDesignadoId(e.target.value)}>
                  <option value="">— Sin designar —</option>
                  {(delegados.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Honorarios profesionales</label>
                <select value={honorariosTipo} onChange={(e) => setHonorariosTipo(e.target.value as TipoHonorarios)}>
                  <option value="">Usar el % por defecto de Configuración</option>
                  <option value="LIBRE">Libre de gastos (0%)</option>
                  <option value="TRES_POR_CIENTO">3%</option>
                  <option value="SEIS_POR_CIENTO">6%</option>
                  <option value="OTRO">Otro %</option>
                </select>
              </div>
              {honorariosTipo === 'OTRO' && (
                <div className="fg">
                  <label>Otro — indicar %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={honorariosPorcentaje}
                    onChange={(e) => setHonorariosPorcentaje(e.target.value)}
                  />
                </div>
              )}
              <div className="fg">
                <label>Ambientes</label>
                <input type="number" min={0} value={ambientes} onChange={(e) => setAmbientes(e.target.value)} />
              </div>
              <div className="fg">
                <label>Baños</label>
                <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)} />
              </div>
              <div className="fg">
                <label>Superficie</label>
                <div className="suffix">
                  <input type="number" min={0} step="0.01" value={superficieM2} onChange={(e) => setSuperficieM2(e.target.value)} />
                  <span>m²</span>
                </div>
              </div>
            </div>
          </div>

          {modalidad === 'ALQUILER' ? (
            <div className="cfgcard">
              <h3>DATOS DE ALQUILER</h3>
              <div className="hint">Índice de ajuste, alquiler inicial y, si ya tiene inquilino, sus datos de contacto.</div>
              <div className="cfgfields">
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
                      <input value={inqNombre} onChange={(e) => setInqNombre(e.target.value)} />
                    </div>
                    <div className="fg">
                      <label>Teléfono</label>
                      <input value={inqTelefono} onChange={(e) => setInqTelefono(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="fg">
                      <label>Email</label>
                      <input type="email" value={inqEmail} onChange={(e) => setInqEmail(e.target.value)} placeholder="Opcional" />
                    </div>
                  </>
                )}
              </div>
              <div className="cfgnote">
                <i>△</i>
                <span>
                  Si no tiene inquilino, la propiedad queda "Disponible" — se muestra como publicable en Ventas y
                  Carteles y, si además está tildado "Mostrar en la página web", en la landing pública. Una vez
                  alquilada, deja de aparecer en la web automáticamente.
                </span>
              </div>
            </div>
          ) : (
            <div className="cfgcard">
              <h3>DATOS DE VENTA</h3>
              <div className="hint">Precio y si la propiedad se publica en la página web pública.</div>
              <div className="cfgfields">
                <div className="fg">
                  <label>Precio</label>
                  <input type="number" min={0} value={precio} onChange={(e) => setPrecio(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Moneda</label>
                  <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div className="fg full">
                  <label className="chk">
                    <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
                    <span>Mostrar en la página web (landing page)</span>
                  </label>
                </div>
                <div className="fg full">
                  <label>Cierre estimado</label>
                  <input type="date" value={cierreEstimado} onChange={(e) => setCierreEstimado(e.target.value)} />
                </div>
              </div>
              <div className="cfgnote">
                <i>◈</i>
                <span>Se puede editar todo esto después desde la ficha de venta, en Ventas y Carteles.</span>
              </div>
            </div>
          )}

          <div className="cfgcard">
            <h3>FOTOS DE LA PROPIEDAD</h3>
            <div className="hint">
              Se muestran en el orden en que se cargan. Van a ser las que se vean en la ficha (de venta o de
              alquiler) y, más adelante, en la página web pública junto con los datos de la propiedad.
            </div>
            <label className="dropzone">
              Hacé clic para elegir fotos (JPG, PNG o WEBP)
              <small>Podés elegir varias a la vez</small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  agregarImagenes(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            {imagenes.length > 0 && (
              <div className="fotogrid">
                {imagenes.map((img, i) => (
                  <div className="fotothumb" key={img.preview}>
                    <img src={img.preview} alt="" />
                    <button
                      type="button"
                      className="quitar"
                      title="Quitar esta foto"
                      onClick={() => quitarImagen(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cfgsave">
          <button className="btn-ghost" onClick={limpiarFormulario}>
            Limpiar formulario
          </button>
          <button className="btn-dark" disabled={!puedeGuardar || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? 'Guardando…' : 'Guardar propiedad'}
          </button>
        </div>
      </main>
    </>
  );
}
