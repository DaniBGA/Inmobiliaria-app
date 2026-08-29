import sharp from 'sharp';

// Ancho/alto estándar de toda foto que se muestra en tarjeta en la landing
// (grilla de propiedades y foto de "Nosotros" — ambas usan una caja 4:5 en
// CSS, ver .property-photo/.nosotros-photo en global.css). Se aplica acá,
// en el servidor, para que:
//  1. El recorte (`cover`) sea siempre el mismo sin importar qué relación
//     de aspecto tenga la foto original (evita el recorte raro que se veía
//     al forzarlo solo por CSS con fotos verticales de celular).
//  2. El archivo pese poco (re-encodeado a JPEG calidad 85) — fotos de
//     celular/cámara sin comprimir hacían that la landing tardara mucho en
//     cargar esa sección.
const ANCHO = 1080;
const ALTO = 1350;

export async function procesarFotoParaTarjeta(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // respeta la orientación EXIF (fotos de celular en portrait)
    .resize(ANCHO, ALTO, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Imagen de portada del carrusel destacado del Hero (Propiedad.heroPortadaUrl)
// — a propósito NO usa `fit:'cover'` como la de arriba: el Hero la muestra
// con `object-fit:contain` (nunca se recorta, ver hero.css), así que acá
// tampoco hay que recortar, solo evitar que un archivo gigante (foto de
// cámara sin comprimir) pese de más. `fit:'inside'` reduce si la imagen
// excede el recuadro sin agrandar una más chica ni deformarla; 1800x1050
// es la proporción recomendada al admin (~3/4 del ancho del carrusel
// contra su alto máximo de 520px en desktop, ver hero.css) pero cualquier
// otra proporción entra igual, sin recorte.
const HERO_ANCHO_MAX = 1800;
const HERO_ALTO_MAX = 1050;

export async function procesarFotoParaHero(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(HERO_ANCHO_MAX, HERO_ALTO_MAX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
