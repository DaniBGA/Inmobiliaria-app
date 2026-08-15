import type { CSSProperties } from 'react';

export type ServicioFacturable =
  | 'EXPENSAS'
  | 'USINA'
  | 'CAMUZZI'
  | 'OBRAS_SANITARIAS'
  | 'RETRIBUTIVAS'
  | 'CLOACAS'
  | 'GAS_ENVASADO'
  | 'SISTEMA_BIODIGESTOR';

export const SERVICIOS_OPCIONES: { key: ServicioFacturable; label: string }[] = [
  { key: 'EXPENSAS', label: 'Expensas' },
  { key: 'USINA', label: 'Luz (Usina)' },
  { key: 'CAMUZZI', label: 'Gas (Camuzzi)' },
  { key: 'OBRAS_SANITARIAS', label: 'Agua (Obras Sanitarias)' },
  { key: 'RETRIBUTIVAS', label: 'Retributivas de Servicios' },
  { key: 'CLOACAS', label: 'Cloacas' },
  { key: 'GAS_ENVASADO', label: 'Gas envasado' },
  { key: 'SISTEMA_BIODIGESTOR', label: 'Sistema biodigestor' },
];

// Datos fijos de cuenta de algunos servicios ("agregar propiedad" / "editar
// datos"), reflejados automáticamente en la factura — ver comentario en
// schema.prisma. Solo se muestran cuando el checkbox del servicio
// correspondiente está tildado. Usado tanto al cargar una propiedad nueva
// como al editar una existente — `wrapperClassName`/`wrapperStyle`/
// `fieldStyle` dejan que cada pantalla mantenga su propio layout alrededor.
export function ServiciosCuentaInputs({
  servicios,
  usinaUsuario,
  setUsinaUsuario,
  obrasSanitariasNumeroCuenta,
  setObrasSanitariasNumeroCuenta,
  camuzziNumeroCuenta,
  setCamuzziNumeroCuenta,
  retributivasNumeroCuenta,
  setRetributivasNumeroCuenta,
  usinaNumeroCuenta,
  setUsinaNumeroCuenta,
  wrapperClassName,
  wrapperStyle,
  fieldStyle,
}: {
  servicios: ServicioFacturable[];
  usinaUsuario: string;
  setUsinaUsuario: (v: string) => void;
  obrasSanitariasNumeroCuenta: string;
  setObrasSanitariasNumeroCuenta: (v: string) => void;
  camuzziNumeroCuenta: string;
  setCamuzziNumeroCuenta: (v: string) => void;
  retributivasNumeroCuenta: string;
  setRetributivasNumeroCuenta: (v: string) => void;
  usinaNumeroCuenta: string;
  setUsinaNumeroCuenta: (v: string) => void;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  fieldStyle?: CSSProperties;
}) {
  const muestraAgua = servicios.includes('OBRAS_SANITARIAS');
  const muestraGas = servicios.includes('CAMUZZI');
  const muestraRetributivas = servicios.includes('RETRIBUTIVAS');
  const muestraLuz = servicios.includes('USINA');
  if (!muestraAgua && !muestraGas && !muestraRetributivas && !muestraLuz) return null;
  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {muestraLuz && (
        <>
          <div className="fg" style={fieldStyle}>
            <label>Luz — Usuario</label>
            <input value={usinaUsuario} onChange={(e) => setUsinaUsuario(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="fg" style={fieldStyle}>
            <label>Luz — N° de control</label>
            <input value={usinaNumeroCuenta} onChange={(e) => setUsinaNumeroCuenta(e.target.value)} placeholder="Opcional" />
          </div>
        </>
      )}
      {muestraAgua && (
        <div className="fg" style={fieldStyle}>
          <label>Agua — N° de cuenta</label>
          <input
            value={obrasSanitariasNumeroCuenta}
            onChange={(e) => setObrasSanitariasNumeroCuenta(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      )}
      {muestraGas && (
        <div className="fg" style={fieldStyle}>
          <label>Gas — N° de cuenta</label>
          <input value={camuzziNumeroCuenta} onChange={(e) => setCamuzziNumeroCuenta(e.target.value)} placeholder="Opcional" />
        </div>
      )}
      {muestraRetributivas && (
        <div className="fg" style={fieldStyle}>
          <label>Retributivas — N° de cuenta</label>
          <input
            value={retributivasNumeroCuenta}
            onChange={(e) => setRetributivasNumeroCuenta(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      )}
    </div>
  );
}
