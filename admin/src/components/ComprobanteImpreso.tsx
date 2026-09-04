import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import logoMembrete from '../images/logo-comprobante-membrete.png';
import logoPie from '../images/logo-comprobante-pie.png';
import logoMarcaAgua from '../images/logo-marca-agua.png';
import logoWhatsapp from '../images/logo-whatsapp-azul.png';

interface DatosComprobante {
  empresaNombre: string;
  empresaDireccion: string;
  empresaContacto: string;
}

// `empresaContacto` (Configuración) es un único campo de texto libre —
// siempre se carga como "teléfono(s) ... · email" (ver todos los
// comprobantes ya emitidos). Se separa acá nomás para poder mostrar el
// ícono de WhatsApp pegado al teléfono y el email en su propia línea abajo,
// sin tener que partir el campo en dos en Configuración (que reemplazaría
// de golpe todos los `empresaContacto` ya cargados).
function splitContacto(contacto: string): { telefono: string; email: string | null } {
  const match = contacto.match(/[^\s]+@[^\s]+/);
  if (!match) return { telefono: contacto, email: null };
  const email = match[0].replace(/[.,;)]+$/, '');
  const telefono = contacto
    .slice(0, match.index)
    .replace(/[·\-–\s]+$/, '')
    // "– Administraciones" (etiqueta del área, no del teléfono en sí — pedido
    // del usuario 2026-09-03: sacarla de al lado del teléfono en el pie).
    .replace(/\s*[-–]\s*administraciones\s*$/i, '')
    .trim();
  return { telefono, email };
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
          <img className="comp-logo" src={logoMembrete} alt="" />
          <div className="comp-datos">
            {cfg?.empresaDireccion && <div className="comp-direccion">{cfg.empresaDireccion}</div>}
            {cfg?.empresaContacto && <div className="comp-contacto">{cfg.empresaContacto}</div>}
          </div>
          <span style={{ flex: 1 }} />
          <div className="comp-titulo">{titulo}</div>
        </div>

        {children}

        {/* Debajo de la última propiedad con datos, no en el pie (pedido del
            usuario 2026-09-03) — más grande y en el azul de marca en vez del
            gris chico que tenía antes como parte del membrete del pie. */}
        <div className="comp-condiciones printonly">
          Los pagos son en efectivo y se abonan sin excepción en la inmobiliaria {cfg?.empresaNombre || 'Facundo París Propiedades'}
          {cfg?.empresaDireccion ? `, sito en ${cfg.empresaDireccion}` : ''}, de Administración de Alquileres, lunes a viernes de
          8:30 a 12hs.
        </div>

        <div className="comp-pie printonly">
          <div className="comp-pierow">
            <img className="comp-pielogo" src={logoPie} alt="" />
            {cfg?.empresaDireccion && <div className="comp-piedireccion">{cfg.empresaDireccion}</div>}
            {cfg?.empresaContacto &&
              (() => {
                const { telefono, email } = splitContacto(cfg.empresaContacto);
                return (
                  <div className="comp-piecontacto">
                    {telefono && (
                      <div className="comp-pietelefono">
                        <img className="comp-iconwsp" src={logoWhatsapp} alt="" />
                        {telefono}
                      </div>
                    )}
                    {email && <div className="comp-pieemail">{email}</div>}
                  </div>
                );
              })()}
          </div>
        </div>
      </div>
    );
  },
);
