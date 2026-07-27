import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}

export function Modal({ open, onClose, title, width = 520, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal on">
      <div className="overlay on" style={{ zIndex: 110 }} onClick={onClose}></div>
      <div className="modalcard" style={{ width: `min(${width}px, 100%)` }}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
