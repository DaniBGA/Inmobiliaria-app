import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';

type Modalidad = 'ALQUILER' | 'VENTA';
type TipoHonorarios = '' | 'LIBRE' | 'TRES_POR_CIENTO' | 'SEIS_POR_CIENTO' | 'OTRO';
type IndiceAjuste = '' | 'IPC' | 'ICL';
type Moneda = 'ARS' | 'USD';
type ServicioFacturable =
  | 'EXPENSAS'
  | 'USINA'
  | 'CAMUZZI'
  | 'OBRAS_SANITARIAS'
  | 'RETRIBUTIVAS'
  | 'CLOACAS'
  | 'GAS_ENVASADO'
  | 'SISTEMA_BIODIGESTOR';
type OrigenCliente = 'INSTAGRAM' | 'PAGINA_WEB' | 'EN_PERSONA' | 'FACEBOOK' | 'CONTACTOS';

const SERVICIOS_OPCIONES: { key: ServicioFacturable; label: string }[] = [
  { key: 'EXPENSAS', label: 'Expensas' },
  { key: 'USINA', label: 'Luz (Usina)' },
  { key: 'CAMUZZI', label: 'Gas (Camuzzi)' },
  { key: 'OBRAS_SANITARIAS', label: 'Agua (Obras Sanitarias)' },
  { key: 'RETRIBUTIVAS', label: 'Retributivas de Servicios' },
  { key: 'CLOACAS', label: 'Cloacas' },
  { key: 'GAS_ENVASADO', label: 'Gas envasado' },
  { key: 'SISTEMA_BIODIGESTOR', label: 'Sistema biodigestor' },
];

const ORIGEN_LABEL: Record<OrigenCliente, string> = {
  INSTAGRAM: 'Instagram',
  PAGINA_WEB: 'Página web',
  EN_PERSONA: 'En persona',
  FACEBOOK: 'Facebook',
  CONTACTOS: 'Contactos',
};

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
  DEPARTAMENTO: 'Departamento',
  DUPLEX: 'Dúplex',
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
  const [origenPropietarioNuevo, setOrigenPropietarioNuevo] = useState<OrigenCliente | ''>('');
  const [designadoId, setDesignadoId] = useState('');
  const [honorariosTipo, setHonorariosTipo] = useState<TipoHonorarios>('');
  const [honorariosPorcentaje, setHonorariosPorcentaje] = useState('');
  const [honorariosAdministracion, setHonorariosAdministracion] = useState(false);
  const [honorariosAdministracionPorcentaje, setHonorariosAdministracionPorcentaje] = useState('');
  const [ambientes, setAmbientes] = useState('');
  const [dormitorios, setDormitorios] = useState('');
  const [banos, setBanos] = useState('');
  const [cochera, setCochera] = useState(false);
  const [caracterEspecial, setCaracterEspecial] = useState(false);
  const [superficieM2, setSuperficieM2] = useState('');
  const [superficieCubierta, setSuperficieCubierta] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [servicios, setServicios] = useState<ServicioFacturable[]>([
    'EXPENSAS',
    'USINA',
    'CAMUZZI',
    'OBRAS_SANITARIAS',
    'RETRIBUTIVAS',
  ]);

  // Alquiler
  const [indice, setIndice] = useState<IndiceAjuste>('');
  const [frecuenciaAumentoMeses, setFrecuenciaAumentoMeses] = useState('');
  const [montoAlquilerInicial, setMontoAlquilerInicial] = useState('');
  const [alquilerPublicado, setAlquilerPublicado] = useState(true);

  // Venta
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USD');
  const [publicada, setPublicada] = useState(true);
  const [cierreEstimado, setCierreEstimado] = useState('');
  const [imagenes, setImagenes] = useState<{ file: File; preview: string }[]>([]);
  // Índice (dentro de `imagenes`) elegido como portada del carrusel
  // destacado — recién se traduce a un fotoId real después de subir las
  // fotos, porque hasta ese momento la propiedad ni siquiera existe.
  const [portadaIdx, setPortadaIdx] = useState<number | null>(null);

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
    setPortadaIdx((prev) => {
      if (prev == null) return prev;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });
  }

  function toggleServicio(key: ServicioFacturable) {
    setServicios((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  function limpiarFormulario() {
    setNombre('');
    setDireccion('');
    setTipo('CASA');
    setModalidad('ALQUILER');
    setPropietarioId('');
    setPropietarioNuevoNombre('');
    setOrigenPropietarioNuevo('');
    setDesignadoId('');
    setHonorariosTipo('');
    setHonorariosPorcentaje('');
    setHonorariosAdministracion(false);
    setHonorariosAdministracionPorcentaje('');
    setAmbientes('');
    setDormitorios('');
    setBanos('');
    setCochera(false);
    setSuperficieM2('');
    setSuperficieCubierta('');
    setDescripcion('');
    setServicios(['EXPENSAS', 'USINA', 'CAMUZZI', 'OBRAS_SANITARIAS', 'RETRIBUTIVAS']);
    setIndice('');
    setFrecuenciaAumentoMeses('');
    setMontoAlquilerInicial('');
    setAlquilerPublicado(true);
    setPrecio('');
    setMoneda('USD');
    setPublicada(true);
    setCierreEstimado('');
    imagenes.forEach((img) => URL.revokeObjectURL(img.preview));
    setImagenes([]);
    setPortadaIdx(null);
  }

  const crear = useMutation({
    mutationFn: async () => {
      let propId = propietarioId;
      if (!propId && propietarioNuevoNombre.trim()) {
        const nuevo = await api.post<Propietario>('/propietarios', { nombre: propietarioNuevoNombre.trim() });
        propId = nuevo.id;

        // Todo propietario nuevo entra también como Cliente (§2.6) — ya
        // tiene una relación activa con la inmobiliaria (nos dio una
        // propiedad), así que arranca "En seguimiento" y no "Sin
        // contactar" como un lead frío recién llegado.
        await api.post('/clientes', {
          nombre: propietarioNuevoNombre.trim(),
          tipoOperacion: 'VENDER',
          estado: 'EN_SEGUIMIENTO',
          origen: origenPropietarioNuevo || undefined,
        });
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
        honorariosAdministracion,
        honorariosAdministracionPorcentaje:
          honorariosAdministracion && honorariosAdministracionPorcentaje
            ? Number(honorariosAdministracionPorcentaje)
            : undefined,
        ambientes: !esLote && ambientes ? Number(ambientes) : undefined,
        dormitorios: !esLote && dormitorios ? Number(dormitorios) : undefined,
        banos: !esLote && banos ? Number(banos) : undefined,
        cochera: !esLote ? cochera : undefined,
        superficieM2: superficieM2 ? Number(superficieM2) : undefined,
        superficieCubierta: !esLote && superficieCubierta ? Number(superficieCubierta) : undefined,
        descripcion: descripcion.trim() || undefined,
        caracterEspecial,
        // Los servicios (luz, gas, etc.) se cargan para cualquier tipo y
        // modalidad — antes solo se guardaban del lado de alquiler.
        serviciosHabilitados: servicios,
        indice: modalidad === 'ALQUILER' && indice ? indice : undefined,
        frecuenciaAumentoMeses: modalidad === 'ALQUILER' && frecuenciaAumentoMeses ? Number(frecuenciaAumentoMeses) : undefined,
        montoAlquilerInicial: modalidad === 'ALQUILER' && montoAlquilerInicial ? Number(montoAlquilerInicial) : undefined,
        alquilerPublicado: modalidad === 'ALQUILER' ? alquilerPublicado : undefined,
      });

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
      let fotoPortadaId: string | null = null;
      for (let i = 0; i < imagenes.length; i++) {
        const { file } = imagenes[i];
        try {
          const form = new FormData();
          form.append('archivo', file);
          const foto = await api.upload<{ id: string }>(`/propiedades/${propiedad.id}/fotos`, form);
          if (i === portadaIdx) fotoPortadaId = foto.id;
        } catch (err) {
          const motivo = err instanceof ApiError ? err.message : 'error desconocido';
          fotosFallidas.push(`${file.name} (${motivo})`);
        }
      }
      // Se marca al final (no en el mismo paso que la subida) porque recién
      // ahí se sabe el id real de la foto elegida.
      if (fotoPortadaId) {
        await api.patch(`/propiedades/${propiedad.id}/fotos/${fotoPortadaId}/portada`).catch(() => {});
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
      qc.invalidateQueries({ queryKey: ['clientes'] });
      limpiarFormulario();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la propiedad.'),
  });

  // Un lote es terreno sin construir — no tiene sentido pedir ambientes,
  // dormitorios, baños ni superficie cubierta, sea alquiler o venta. Los
  // servicios (luz, gas, etc.), en cambio, se preguntan siempre para
  // cualquier tipo de propiedad y modalidad — antes solo se pedían del
  // lado de alquiler.
  const esLote = tipo === 'LOTE';

  const puedeGuardar =
    nombre.trim() &&
    direccion.trim() &&
    (propietarioId || (propietarioNuevoNombre.trim() && origenPropietarioNuevo)) &&
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
                    if (e.target.value) {
                      setPropietarioNuevoNombre('');
                      setOrigenPropietarioNuevo('');
                    }
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
              {propietarioNuevoNombre.trim() && (
                <div className="fg">
                  <label>Origen del propietario nuevo</label>
                  <select value={origenPropietarioNuevo} onChange={(e) => setOrigenPropietarioNuevo(e.target.value as OrigenCliente | '')}>
                    <option value="">— Elegir —</option>
                    {Object.entries(ORIGEN_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <label className="chk" style={{ marginTop: 28 }}>
                  <input
                    type="checkbox"
                    checked={honorariosAdministracion}
                    onChange={(e) => setHonorariosAdministracion(e.target.checked)}
                  />
                  <span>Honorarios de administración</span>
                </label>
              </div>
              {honorariosAdministracion && (
                <div className="fg">
                  <label>Honorarios de administración — %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={honorariosAdministracionPorcentaje}
                    onChange={(e) => setHonorariosAdministracionPorcentaje(e.target.value)}
                  />
                </div>
              )}
              {!esLote && (
                <>
                  <div className="fg">
                    <label>Ambientes</label>
                    <input type="number" min={0} value={ambientes} onChange={(e) => setAmbientes(e.target.value)} />
                  </div>
                  <div className="fg">
                    <label>Dormitorios</label>
                    <input type="number" min={0} value={dormitorios} onChange={(e) => setDormitorios(e.target.value)} />
                  </div>
                  <div className="fg">
                    <label>Baños</label>
                    <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)} />
                  </div>
                </>
              )}
              <div className="fg">
                <label>Superficie total</label>
                <div className="suffix">
                  <input type="number" min={0} step="0.01" value={superficieM2} onChange={(e) => setSuperficieM2(e.target.value)} />
                  <span>m²</span>
                </div>
              </div>
              {!esLote && (
                <div className="fg">
                  <label>Superficie cubierta</label>
                  <div className="suffix">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={superficieCubierta}
                      onChange={(e) => setSuperficieCubierta(e.target.value)}
                    />
                    <span>m²</span>
                  </div>
                </div>
              )}
              {!esLote && (
                <div className="fg">
                  <label className="chk" style={{ marginTop: 28 }}>
                    <input type="checkbox" checked={cochera} onChange={(e) => setCochera(e.target.checked)} />
                    <span>Tiene cochera</span>
                  </label>
                </div>
              )}
              <div className="fg">
                <label className="chk" style={{ marginTop: 28 }}>
                  <input
                    type="checkbox"
                    checked={caracterEspecial}
                    onChange={(e) => setCaracterEspecial(e.target.checked)}
                  />
                  <span>Carácter especial (aparece en el carrusel destacado de la landing)</span>
                </label>
              </div>
              <div className="fg full">
                <label>Descripción</label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Breve descripción del lugar (opcional)"
                />
              </div>
            </div>
          </div>

          {modalidad === 'ALQUILER' ? (
            <div className="cfgcard">
              <h3>DATOS DE ALQUILER</h3>
              <div className="hint">
                Índice de ajuste, alquiler inicial y qué servicios se ofrecen al emitir la factura del mes. La
                propiedad se carga vacante — asignarle un inquilino se hace después, desde Ventas y Carteles o
                Inquilinos y Cobros.
              </div>
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
                <div className="fg full">
                  <label className="chk">
                    <input type="checkbox" checked={alquilerPublicado} onChange={(e) => setAlquilerPublicado(e.target.checked)} />
                    <span>Mostrar en la página web (landing page)</span>
                  </label>
                </div>
                <div className="fg full">
                  <label>Servicios que se facturan</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 4 }}>
                    {SERVICIOS_OPCIONES.map((s) => (
                      <label className="chk" key={s.key}>
                        <input type="checkbox" checked={servicios.includes(s.key)} onChange={() => toggleServicio(s.key)} />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="cfgnote">
                <i>△</i>
                <span>
                  La propiedad queda "Disponible" — se muestra como publicable en Ventas y Carteles y, si además está
                  tildado "Mostrar en la página web", en la landing pública. Una vez alquilada, deja de aparecer en la
                  web automáticamente.
                </span>
              </div>
            </div>
          ) : (
            <div className="cfgcard">
              <h3>DATOS DE VENTA</h3>
              <div className="hint">Precio, si la propiedad se publica en la página web pública y qué servicios tiene.</div>
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
                <div className="fg full">
                  <label>Servicios</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 4 }}>
                    {SERVICIOS_OPCIONES.map((s) => (
                      <label className="chk" key={s.key}>
                        <input type="checkbox" checked={servicios.includes(s.key)} onChange={() => toggleServicio(s.key)} />
                        <span>{s.label}</span>
                      </label>
                    ))}
                  </div>
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
            {caracterEspecial && imagenes.length > 1 && (
              <div className="hint" style={{ marginTop: 10 }}>
                ★ Marcá con la estrella qué foto se usa en el carrusel destacado de la landing (por defecto se usa la
                primera).
              </div>
            )}
            {imagenes.length > 0 && (
              <div className="fotogrid">
                {imagenes.map((img, i) => (
                  <div className="fotothumb" key={img.preview}>
                    <img src={img.preview} alt="" />
                    {caracterEspecial && imagenes.length > 1 && (
                      <button
                        type="button"
                        className={`portada${portadaIdx === i ? ' activa' : ''}`}
                        title={portadaIdx === i ? 'Portada del carrusel destacado' : 'Usar como portada del carrusel destacado'}
                        onClick={() => setPortadaIdx((prev) => (prev === i ? null : i))}
                      >
                        ★
                      </button>
                    )}
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
