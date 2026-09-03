import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Genera el PDF del comprobante (Factura/Liquidación) a partir del mismo
// nodo `.comprobante` que arma `<ComprobanteImpreso>` — el que ya se usa
// para @media print — y dispara la descarga en el navegador.
//
// html2canvas rasteriza el nodo tal cual está en pantalla (no evalúa
// `@media print`), así que el membrete/marca de agua/pie — ocultos con
// `display:none` fuera de @media print — no aparecerían solos. Para no
// flashear el membrete en el modal real mientras se genera el PDF, se
// clona el nodo fuera de pantalla y se fuerza la visibilidad SOLO en el
// clon. El resto del estilo (colores/bordes/tipografía de
// `.comp-*`/`.liqcard`/`.liqline`) vive en reglas normales de
// `global.css` que NO dependen de `@media print` — esas sí las agarra
// html2canvas solo con forzar el `display`. Lo único que además hay que
// resolver acá a mano es el `position:fixed` que usan `.comp-marcaagua` y
// `.comp-pie` en `@media print` (pensado para pegarse al borde de la hoja
// física real) — no tiene sentido capturando un nodo suelto con
// html2canvas, así que acá se posicionan `absolute` relativos a
// `.comprobante` (o, en el caso del pie, en el flujo normal después del
// contenido) en vez de fixed.
export async function descargarPdfComprobante(nodo: HTMLElement, nombreArchivo: string): Promise<void> {
  const clon = nodo.cloneNode(true) as HTMLElement;
  clon.style.position = 'fixed';
  clon.style.left = '-10000px';
  clon.style.top = '0';
  clon.style.width = '780px';
  clon.style.background = '#ffffff';
  clon.style.padding = '30px 34px';
  clon.style.boxSizing = 'border-box';

  const marcaAgua = clon.querySelector<HTMLElement>('.comp-marcaagua');
  if (marcaAgua) {
    Object.assign(marcaAgua.style, {
      display: 'block',
      position: 'absolute',
      left: '-140px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '600px',
      opacity: '.05',
      zIndex: '0',
    });
  }
  // Solo se fuerza acá lo que de verdad depende de `@media print` (el
  // `display` del membrete/pie, ocultos por default fuera de esa media
  // query, y el `position:fixed` del pie que no tiene sentido en un nodo
  // suelto) — colores, bordes, tipografía y el tamaño de los logos ya
  // vienen de reglas normales de `global.css` (ver comentario arriba).
  const membrete = clon.querySelector<HTMLElement>('.comp-membrete');
  if (membrete) {
    Object.assign(membrete.style, { display: 'flex', position: 'relative', zIndex: '1' });
  }
  const pie = clon.querySelector<HTMLElement>('.comp-pie');
  if (pie) {
    Object.assign(pie.style, { display: 'flex', marginTop: '40px', position: 'relative', zIndex: '1' });
  }

  const cuerpo = clon.querySelector<HTMLElement>('.liqcard');
  if (cuerpo) {
    Object.assign(cuerpo.style, { position: 'relative', zIndex: '1' });
  }

  document.body.appendChild(clon);
  try {
    // `scale: 1.5` (no 2) + JPEG en vez de PNG: un PNG sin pérdida a escala
    // 2x de una página con texto+degradados terminaba pesando 10 MB+ por
    // comprobante — nada razonable para adjuntar en WhatsApp. JPEG calidad
    // .92 sobre fondo blanco opaco (por eso `backgroundColor:'#ffffff'`,
    // JPEG no soporta transparencia) baja esto a un rango normal (cientos
    // de KB) sin pérdida visible de nitidez en el texto.
    const canvas = await html2canvas(clon, { scale: 1.5, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let alturaRestante = imgHeight;
    let y = 0;
    pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
    alturaRestante -= pageHeight;
    while (alturaRestante > 0) {
      y = alturaRestante - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
      alturaRestante -= pageHeight;
    }
    pdf.save(nombreArchivo);
  } finally {
    document.body.removeChild(clon);
  }
}
