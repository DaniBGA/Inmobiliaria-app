import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}

// Bandeja compartida de modales minimizados (pedido del usuario
// 2026-10-15: "que se puedan minimizar y mover como si fueran una
// ventana") — un único nodo en <body>, reusado por TODAS las instancias
// de `Modal` a la vez. Portar cada pill ahí (en vez de que cada `Modal`
// se posicione solo con su propio `position:fixed`) es lo que permite que
// varios minimizados se apilen sin que una instancia tenga que saber nada
// de las demás (ver `.modal-tray` en global.css: flexbox hace el resto).
function getTray(): HTMLElement {
  let tray = document.getElementById('modal-tray');
  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'modal-tray';
    tray.className = 'modal-tray';
    document.body.appendChild(tray);
  }
  return tray;
}

export function Modal({ open, onClose, title, width = 520, children }: ModalProps) {
  const [minimizado, setMinimizado] = useState(false);
  // `null` = todavía no se arrastró, sigue centrado por el flex de `.modal`
  // (ver global.css). Recién al primer drag se fija una posición concreta
  // en píxeles — así un modal que nunca se toca se comporta exactamente
  // igual que antes de este cambio.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; ancho: number } | null>(
    null,
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const x = d.origX + (e.clientX - d.startX);
      const y = d.origY + (e.clientY - d.startY);
      // Clamp simple: no se puede soltar el modal completamente fuera de
      // pantalla (quedaría "perdido", sin forma de volver a agarrarlo del
      // encabezado) — siempre se puede arrastrar de vuelta al menos un
      // pedazo de la barra de título.
      const minX = -(d.ancho - 80);
      const maxX = window.innerWidth - 80;
      setPos({ x: Math.min(Math.max(x, minX), maxX), y: Math.max(y, 0) });
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function iniciarArrastre(e: React.MouseEvent) {
    // Los botones de minimizar/cerrar viven adentro de `.modalhead`, que es
    // la misma barra que dispara el drag — sin este chequeo, un clic en
    // cualquiera de los dos también movería el modal un pixel antes de
    // ejecutar la acción.
    if ((e.target as HTMLElement).closest('button')) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const origen = pos ?? { x: rect.left, y: rect.top };
    if (!pos) setPos(origen);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: origen.x, origY: origen.y, ancho: rect.width };
  }

  if (!open) return null;

  // `position` SOLO por estilo inline, nunca por clase: así la regla de
  // impresión (`.modalcard{position:static!important}`, global.css) sigue
  // ganando siempre y el comprobante se sigue fragmentando en varias hojas
  // al imprimir — si esto se moviera a `!important` en línea React no lo
  // permite, por eso el `!important` vive del lado del CSS de impresión.
  const modal = (
    // `.modal` es `position:fixed;inset:0` — un div transparente que cubre
    // toda la pantalla sigue bloqueando clics aunque esté "vacío" visualmente
    // (`.modalcard` en `display:none` de abajo no alcanza por sí solo).
    // `pointerEvents:'none'` acá es lo que de verdad libera el resto de la
    // página para interactuar mientras el modal está minimizado.
    <div className="modal on" style={minimizado ? { pointerEvents: 'none' } : undefined}>
      {!minimizado && <div className="overlay on" style={{ zIndex: 110 }} onClick={onClose}></div>}
      <div
        ref={cardRef}
        className="modalcard"
        style={{
          width: `min(${width}px, 100%)`,
          display: minimizado ? 'none' : undefined,
          ...(pos ? { position: 'fixed', left: pos.x, top: pos.y, margin: 0 } : {}),
        }}
      >
        <div className="modalhead noprint" onMouseDown={iniciarArrastre}>
          <h2>{title}</h2>
          <div className="modalhead-actions">
            <button type="button" className="modalhead-btn" title="Minimizar" onClick={() => setMinimizado(true)}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 19h14" />
              </svg>
            </button>
            <button type="button" className="modalhead-btn cerrar" title="Cerrar" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  // Portal a <body>: el modal queda como hermano de #root en vez de
  // enterrado adentro de la página que lo abrió. Esto es lo que le permite
  // a @media print (global.css) ocultar #root entero y dejar que
  // `.modalcard` fluya como contenido normal de la página impresa — antes,
  // al estar anidado adentro del layout normal, necesitaba `position:fixed`
  // para "escapar" visualmente, y un elemento fixed nunca se parte en
  // varias hojas al imprimir (limitación real del motor de impresión): un
  // comprobante largo (muchas propiedades/ítems) se cortaba en la primera
  // hoja en vez de seguir en una segunda.
  return (
    <>
      {createPortal(modal, document.body)}
      {minimizado &&
        createPortal(
          <div className="modal-pill" title={title} onClick={() => setMinimizado(false)}>
            <span>{title}</span>
            <button
              type="button"
              title="Cerrar"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>,
          getTray(),
        )}
    </>
  );
}
