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
