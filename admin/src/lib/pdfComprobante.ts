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
  // El pie va pegado al borde inferior de la ÚLTIMA hoja, no flotando
  // después del contenido con aire de sobra debajo (pedido del usuario
  // 2026-09-03) — se resuelve con flexbox (`margin-top:auto` en el pie,
  // ver más abajo) más forzar la altura del clon a un múltiplo exacto de
  // una hoja A4 antes de rasterizar (ver más abajo, después de armar
  // `pie`), calculado en base al contenido real.
  clon.style.display = 'flex';
  clon.style.flexDirection = 'column';

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
  // Las condiciones de pago (§ pedido del usuario 2026-09-03) quedaron
  // sueltas entre el contenido y el pie, no adentro de `.comp-pie` — igual
  // que el membrete/pie, dependen de `@media print` para mostrarse y
  // html2canvas no la evalúa.
  const condiciones = clon.querySelector<HTMLElement>('.comp-condiciones');
  if (condiciones) {
    Object.assign(condiciones.style, { display: 'block', position: 'relative', zIndex: '1' });
  }
  const pie = clon.querySelector<HTMLElement>('.comp-pie');
  if (pie) {
    // `margin-top:auto` (contenedor flex-column): empuja el pie hasta el
    // final de la altura del clon, sea cual sea — el aire que antes quedaba
    // como espacio en blanco DEBAJO del pie pasa a quedar ARRIBA de él
    // (entre el contenido y el pie), que es donde tiene que estar.
    Object.assign(pie.style, { display: 'flex', marginTop: 'auto', paddingTop: '18px', position: 'relative', zIndex: '1' });
  }

  const cuerpo = clon.querySelector<HTMLElement>('.liqcard');
  if (cuerpo) {
    Object.assign(cuerpo.style, { position: 'relative', zIndex: '1' });
  }

  document.body.appendChild(clon);
  try {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Se mide el contenido YA con el pie de imprimir visible pero antes de
    // estirar nada, y se redondea para arriba al múltiplo de una hoja A4
    // completa (en la misma escala de 780px de ancho que se va a
    // rasterizar) — así el `margin-top:auto` de arriba deja el pie pegado
    // exactamente al borde inferior de la ÚLTIMA hoja, en vez de flotando
    // a mitad de página con aire de sobra debajo.
    const alturaPaginaEnClon = pageHeight * (780 / pageWidth);
    const alturaContenido = clon.scrollHeight;
    const paginas = Math.max(1, Math.ceil(alturaContenido / alturaPaginaEnClon));
    clon.style.height = `${paginas * alturaPaginaEnClon}px`;

    // `scale: 2.5` + JPEG en vez de PNG: un PNG sin pérdida a esta escala de
    // una página con texto+degradados terminaría pesando varios MB por
    // comprobante — nada razonable para adjuntar en WhatsApp. JPEG calidad
    // .95 sobre fondo blanco opaco (por eso `backgroundColor:'#ffffff'`,
    // JPEG no soporta transparencia) mantiene el archivo en un rango
    // razonable (menos de 1-2 MB) con mucha más nitidez que la escala 1.5
    // de antes (pedido del usuario 2026-09-04: "se ven un poco pixeladas").
    const canvas = await html2canvas(clon, { scale: 2.5, backgroundColor: '#ffffff' });
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Tolerancia de 1pt: al forzar `clon.style.height` a un múltiplo exacto
    // de página (arriba), el redondeo a píxel entero del canvas rasterizado
    // deja un resto ínfimo (fracciones de punto) que con `> 0` alcanzaba
    // para disparar una página extra casi en blanco al final del PDF.
    let alturaRestante = imgHeight;
    let y = 0;
    pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
    alturaRestante -= pageHeight;
    while (alturaRestante > 1) {
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
