import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Genera el PDF del comprobante (Factura/Liquidación) a partir del mismo
// nodo `.comprobante` que arma `<ComprobanteImpreso>` — el que ya se usa
// para @media print — y dispara la descarga en el navegador.
//
// html2canvas rasteriza el nodo tal cual está en pantalla (no evalúa
// `@media print`), así que el membrete/pie — ocultos con `display:none`
// fuera de @media print — no aparecerían solos. Para no flashear el
// membrete en el modal real mientras se genera el PDF, se clona el nodo
// fuera de pantalla y se fuerza la visibilidad SOLO en el clon. El resto
// del estilo (colores/bordes/tipografía de `.comp-*`) vive en reglas
// normales de `global.css` que NO dependen de `@media print` — esas sí
// las agarra html2canvas solo con forzar el `display`. Lo único que
// además hay que resolver acá a mano es el `position:fixed` que usa
// `.comp-pie` en `@media print` (pensado para pegarse al borde de la hoja
// física real) — no tiene sentido capturando un nodo suelto con
// html2canvas, así que acá se posiciona en el flujo normal después del
// contenido en vez de fixed.
//
// El pie se repite en TODAS las hojas, no solo la última (pedido del
// usuario 2026-10-01) — ver el comentario de `empujarAHojaNueva()` más
// abajo para el cómo exacto.
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

  const cuerpo = clon.querySelector<HTMLElement>('.comp-cuerpo');
  if (cuerpo) {
    Object.assign(cuerpo.style, { position: 'relative', zIndex: '1' });
  }

  document.body.appendChild(clon);
  try {
    // Todas las mediciones de abajo (altura del pie, de cada propiedad, del
    // contenido entero) dependen del layout YA renderizado — si algún logo
    // (`<img>`) del clon todavía no cargó, su altura real (una vez cargado)
    // puede terminar siendo mayor a la medida acá, corriendo todo lo que
    // venga después y desalineando los saltos de hoja calculados más abajo.
    // `img.decode()` espera la carga Y el decodificado (más estricto
    // que solo esperar `onload`); si la imagen ya está en caché del
    // navegador (lo normal: el comprobante original, aunque oculto con
    // `display:none`, ya la precargó) resuelve prácticamente al instante.
    await Promise.all(
      Array.from(clon.querySelectorAll('img')).map((img) => img.decode().catch(() => {})),
    );

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

    // Paginado "a mano" (pedido del usuario 2026-09-19, regla de cuántas
    // propiedades por hoja actualizada 2026-09-30): como el PDF sale de
    // rebanar una sola imagen larga en franjas de una hoja cada una (ver
    // el bucle de `pdf.addImage` más abajo), por default esa rebanada corta
    // a la mitad cualquier cosa que caiga justo en el borde — en una
    // Liquidación con varias propiedades, el corte podía partir el bloque
    // de una propiedad en dos hojas. Antes de rasterizar, se insertan
    // separadores en blanco para forzar que cada `.comp-propgrupo` (cada
    // propiedad) arranque en una hoja nueva cada 3 propiedades, y que el
    // bloque final de totales (`.comp-totalesgrupo`) se empuje entero a la
    // hoja siguiente si no entra completo en lo que queda de la actual — no
    // se fuerza siempre a una hoja nueva porque la mayoría de las veces sí
    // entra debajo de la última propiedad.
    const origenY = clon.getBoundingClientRect().top;
    const posicionEnClon = (el: HTMLElement) => el.getBoundingClientRect().top - origenY;
    // Empuja `el` hacia abajo (con un `<div>` espaciador insertado antes)
    // hasta que su borde superior caiga justo al arrancar la próxima hoja,
    // más un margen extra (pedido del usuario 2026-09-30: el resumen
    // quedaba pegado al borde de arriba al saltar de hoja) — la hoja 1 ya
    // tiene ese aire gracias al padding propio del clon (`30px 34px`, ver
    // más arriba), pero una hoja 2+ armada acá "a mano" no lo hereda solo
    // por rebanar la imagen larga en franjas.
    const MARGEN_SALTO_HOJA = 18;
    // Pie repetido al final de CADA hoja (pedido del usuario 2026-10-01:
    // antes solo aparecía una vez, al final de TODO el comprobante, por el
    // `margin-top:auto` de más arriba) — se mide una sola vez acá (mismo
    // contenido/ancho en cualquier hoja, así que la altura es siempre la
    // misma) para poder reservarle exactamente su lugar antes del borde de
    // cada hoja forzada.
    const alturaPie = pie ? pie.getBoundingClientRect().height : 0;
    // Repite el membrete (logo + datos + título) al principio de CADA hoja
    // nueva que se fuerza acá (pedido del usuario 2026-09-30) — la hoja 1
    // ya lo tiene tal cual viene en el DOM; de la 2 en adelante se clona el
    // MISMO nodo ya forzado a visible más arriba, así queda con el mismo
    // estilo sin tener que repetir la lógica de "display" a mano. Mismo
    // criterio para el pie (2026-10-01): se clona el nodo `pie` ya forzado
    // visible y se le saca el `margin-top:auto` (acá no tiene que
    // empujarse solo, el espaciador de arriba ya lo deja en su lugar).
    //
    // Orden de los 4 elementos insertados antes de `el` (cada
    // `insertBefore(X, el)` dejar a `X` pegado justo antes de `el`, en el
    // mismo orden en que se llama): espaciador1 → pie → espaciador2
    // (margen) → membrete → el. Los primeros DOS espaciadores separan la
    // altura restante de la hoja actual en dos partes: lo que sobra ANTES
    // del pie (`espaciador1`, puede ser 0 si el contenido llega justo hasta
    // donde empieza el pie) y el margen de aire DESPUÉS del pie, antes del
    // membrete de la hoja nueva (`espaciador2` = `MARGEN_SALTO_HOJA`, el
    // mismo margen que ya existía antes de este cambio). Bug encontrado
    // 2026-10-01 ("el footer se ve cortado cuando hay 3 propiedades"): la
    // primera versión de este fix metía el `MARGEN_SALTO_HOJA` DENTRO del
    // primer espaciador (antes del pie) en vez de en uno aparte después —
    // eso empujaba el pie exactamente `MARGEN_SALTO_HOJA` píxeles de más,
    // así que terminaba `MARGEN_SALTO_HOJA` px DENTRO de la hoja siguiente
    // en vez de justo en el borde de la hoja actual, y la rebanada de
    // `pdf.addImage()` lo cortaba a la mitad. Con el margen en su propio
    // espaciador DESPUÉS del pie, el pie siempre termina en una posición
    // que es múltiplo exacto de `alturaPaginaEnClon` (el borde real de la
    // hoja), sin importar cuánto aire haya antes.
    function empujarAHojaNueva(el: HTMLElement) {
      const top = posicionEnClon(el);
      const resto = top % alturaPaginaEnClon;
      if (resto <= 1) return; // ya arranca (o casi) al principio de una hoja
      const espacioAntesDelPie = document.createElement('div');
      espacioAntesDelPie.style.height = `${Math.max(alturaPaginaEnClon - resto - alturaPie, 0)}px`;
      espacioAntesDelPie.style.flexShrink = '0';
      el.parentElement?.insertBefore(espacioAntesDelPie, el);
      if (pie) {
        const pieClon = pie.cloneNode(true) as HTMLElement;
        Object.assign(pieClon.style, { flexShrink: '0', marginTop: '0' });
        el.parentElement?.insertBefore(pieClon, el);
      }
      const margenHojaNueva = document.createElement('div');
      margenHojaNueva.style.height = `${MARGEN_SALTO_HOJA}px`;
      margenHojaNueva.style.flexShrink = '0';
      el.parentElement?.insertBefore(margenHojaNueva, el);
      if (membrete) {
        const membreteClon = membrete.cloneNode(true) as HTMLElement;
        membreteClon.style.flexShrink = '0';
        el.parentElement?.insertBefore(membreteClon, el);
      }
    }
    const paginaDe = (y: number) => Math.floor(y / alturaPaginaEnClon);

    // Hasta 3 propiedades por hoja (pedido del usuario 2026-09-30, reemplaza
    // la regla anterior de "una propiedad = una hoja"): se fuerza una hoja
    // nueva cada 3 propiedades, sea cual sea su altura real — así el
    // paginado queda predecible en vez de depender de cuántas entrarían a
    // ojo. El resumen de liquidación (`.comp-totalesgrupo`, más abajo) no
    // se fuerza a una hoja aparte: si el grupo final tiene 1 o 2
    // propiedades sobra lugar y queda en la misma hoja; si tiene 3 (grupo
    // lleno), SIEMPRE cae a la siguiente — no alcanza con chequear si
    // técnicamente entraría (pedido del usuario 2026-09-30: con el diseño
    // más compacto a veces sí entraba de milagro, pero quedaba todo muy
    // apretado contra el pie, así que con 3 propiedades se fuerza el salto
    // directo, sin medir).
    const grupos = clon.querySelectorAll<HTMLElement>('.comp-propgrupo');
    grupos.forEach((grupo, i) => {
      if (i === 0) return; // la primera propiedad ya comparte hoja con el membrete/info, no hace falta empujarla
      if (i % 3 === 0) {
        empujarAHojaNueva(grupo);
        return;
      }
      // Salvaguarda para el caso raro de una propiedad tan larga que igual
      // quedaría cortada dentro de su grupo de 3 (p. ej. muchos servicios
      // cargados) — mismo chequeo que ya usa el resumen más abajo.
      const top = posicionEnClon(grupo);
      const bottom = top + grupo.getBoundingClientRect().height;
      if (paginaDe(top) !== paginaDe(bottom - 1)) {
        empujarAHojaNueva(grupo);
      }
    });
    const totales = clon.querySelector<HTMLElement>('.comp-totalesgrupo');
    if (totales) {
      const ultimoGrupoLleno = grupos.length > 0 && grupos.length % 3 === 0;
      if (ultimoGrupoLleno) {
        empujarAHojaNueva(totales);
      } else {
        const top = posicionEnClon(totales);
        const bottom = top + totales.getBoundingClientRect().height;
        if (paginaDe(top) !== paginaDe(bottom - 1)) {
          empujarAHojaNueva(totales);
        }
      }
    }

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
