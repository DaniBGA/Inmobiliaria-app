import { useState } from 'react';
import { descargarPdfComprobante } from '../lib/pdfComprobante';

// Compartido entre "Emitir Factura" (PropiedadFichaDrawer) y "Generar
// Liquidación" (PropietariosPage) — ambos hacían exactamente lo mismo
// (generar el PDF del comprobante oculto y abrir WhatsApp con el archivo
// ya descargado) con su propio estado `enviandoWhatsapp` copy-pasteado; lo
// único que difiere entre los dos es cómo arman el nombre de archivo y el
// texto del mensaje, que quedan a cargo de quien llama a `enviar()`.
export function useEnviarComprobantePorWhatsapp() {
  const [enviando, setEnviando] = useState(false);

  async function enviar(params: {
    elemento: HTMLElement | null;
    telefono: string | null | undefined;
    nombreArchivo: string;
    texto: string;
  }) {
    const { elemento, telefono, nombreArchivo, texto } = params;
    if (!elemento || !telefono) return;
    setEnviando(true);
    try {
      await descargarPdfComprobante(elemento, nombreArchivo);
      window.open(`https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, enviar };
}
