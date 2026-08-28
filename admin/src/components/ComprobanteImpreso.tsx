import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import logoComprobante from '../images/logo-comprobante.png';
import logoMarcaAgua from '../images/logo-marca-agua.png';

interface DatosComprobante {
  empresaDireccion: string;
  empresaContacto: string;
  publicoMatricula: string;
}

// Membrete de la inmobiliaria para comprobantes impresos (§2.10) — usado por
// Factura (`PropiedadFichaDrawer.tsx`) y Liquidación (`PropietariosPage.tsx`).
// Solo existe para el papel: todo acá adentro lleva la clase `printonly`
// (`display:none` en pantalla, reabierta dentro de `@media print` en
// `global.css`), así que en el modal en pantalla no se ve nada de esto.
// Expone un `ref` al nodo raíz porque `lib/pdfComprobante.ts` necesita
// agarrarlo para clonarlo y generar el PDF que manda el botón de WhatsApp.
export const ComprobanteImpreso = forwardRef<
  HTMLDivElement,
  { cfg?: DatosComprobante; ocultarMatricula?: boolean; children: ReactNode }
>(
  function ComprobanteImpreso({ cfg, ocultarMatricula, children }, ref) {
    return (
      <div className="comprobante" ref={ref}>
        <img className="comp-marcaagua printonly" src={logoMarcaAgua} alt="" aria-hidden="true" />
        {!ocultarMatricula && cfg?.publicoMatricula && (
          <div className="comp-matricula printonly">{cfg.publicoMatricula}</div>
        )}

        <div className="comp-membrete printonly">
          <img className="comp-logo" src={logoComprobante} alt="" />
          <div className="comp-datos">
            {cfg?.empresaDireccion && <div className="comp-direccion">{cfg.empresaDireccion}</div>}
            {cfg?.empresaContacto && <div className="comp-contacto">{cfg.empresaContacto}</div>}
          </div>
        </div>

        {children}

        <div className="comp-pie printonly">
          <img className="comp-pielogo" src={logoComprobante} alt="" />
          {cfg?.empresaDireccion && <div className="comp-piedireccion">{cfg.empresaDireccion}</div>}
          {cfg?.empresaContacto && <div className="comp-piecontacto">{cfg.empresaContacto}</div>}
        </div>
      </div>
    );
  },
);
