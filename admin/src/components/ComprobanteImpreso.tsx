import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import logoComprobante from '../images/logo-comprobante.png';
import logoMarcaAgua from '../images/logo-marca-agua.png';

interface DatosComprobante {
  empresaNombre: string;
  empresaDireccion: string;
  empresaContacto: string;
}

// Membrete de la inmobiliaria para comprobantes impresos (§2.10) — usado por
// Factura y Recibo (`PropiedadFichaDrawer.tsx`) y Liquidación
// (`PropietariosPage.tsx` / `AvisosPage.tsx`). Solo existe para el papel:
// todo acá adentro lleva la clase `printonly` (`display:none` en pantalla,
// reabierta dentro de `@media print` en `global.css`), así que en el modal
// en pantalla no se ve nada de esto. Expone un `ref` al nodo raíz porque
// `lib/pdfComprobante.ts` necesita agarrarlo para clonarlo y generar el PDF
// que manda el botón de WhatsApp.
//
// Diseño (pedido del usuario 2026-09-02, en base al boceto histórico en
// papel "Liquidación de Alquiler"): título grande junto al logo, condiciones
// de pago en el pie. A propósito SIN matrícula/N° de colegiado (antes se
// mostraba en Liquidación y se ocultaba solo en Factura vía `ocultarMatricula`
// — ahora no se muestra en ningún comprobante, por pedido explícito).
export const ComprobanteImpreso = forwardRef<
  HTMLDivElement,
  { cfg?: DatosComprobante; titulo: string; children: ReactNode }
>(
  function ComprobanteImpreso({ cfg, titulo, children }, ref) {
    return (
      <div className="comprobante" ref={ref}>
        <img className="comp-marcaagua printonly" src={logoMarcaAgua} alt="" aria-hidden="true" />

        <div className="comp-membrete printonly">
          <img className="comp-logo" src={logoComprobante} alt="" />
          <div className="comp-datos">
            {cfg?.empresaDireccion && <div className="comp-direccion">{cfg.empresaDireccion}</div>}
            {cfg?.empresaContacto && <div className="comp-contacto">{cfg.empresaContacto}</div>}
          </div>
          <span style={{ flex: 1 }} />
          <div className="comp-titulo">{titulo}</div>
        </div>

        {children}

        <div className="comp-pie printonly">
          <div className="comp-condiciones">
            Los pagos son en efectivo y se abonan sin excepción en la inmobiliaria {cfg?.empresaNombre || 'Facundo París Propiedades'}
            {cfg?.empresaDireccion ? `, sito en ${cfg.empresaDireccion}` : ''}, de Administración de Alquileres, lunes a viernes de
            8:30 a 12hs. El pago deberá efectuarse del 01 al 10 de cada mes, sin excepción, caso contrario se aplicará la cláusula
            octava del contrato de locación vigente entre partes.
          </div>
          <div className="comp-pierow">
            <img className="comp-pielogo" src={logoComprobante} alt="" />
            {cfg?.empresaDireccion && <div className="comp-piedireccion">{cfg.empresaDireccion}</div>}
            {cfg?.empresaContacto && <div className="comp-piecontacto">{cfg.empresaContacto}</div>}
          </div>
        </div>
      </div>
    );
  },
);
