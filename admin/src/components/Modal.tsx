import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}

export function Modal({ open, onClose, title, width = 520, children }: ModalProps) {
  if (!open) return null;
  // Portal a <body>: el modal queda como hermano de #root en vez de
  // enterrado adentro de la página que lo abrió. Esto es lo que le permite
  // a @media print (global.css) ocultar #root entero y dejar que
  // `.modalcard` fluya como contenido normal de la página impresa — antes,
  // al estar anidado adentro del layout normal, necesitaba `position:fixed`
  // para "escapar" visualmente, y un elemento fixed nunca se parte en
  // varias hojas al imprimir (limitación real del motor de impresión): un
  // comprobante largo (muchas propiedades/ítems) se cortaba en la primera
  // hoja en vez de seguir en una segunda.
  return createPortal(
    <div className="modal on">
      <div className="overlay on" style={{ zIndex: 110 }} onClick={onClose}></div>
      <div className="modalcard" style={{ width: `min(${width}px, 100%)` }}>
        {/* `noprint`: este título es de la ventana modal, no del comprobante
            — al imprimir (Factura/Recibo/Liquidación) solo debe quedar el
            membrete propio de `ComprobanteImpreso.tsx`, arriba del logo. */}
        <h2 className="noprint">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
