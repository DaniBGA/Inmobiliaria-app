// Sustituye placeholders `{clave}` en una plantilla editable desde
// Configuración (ej. "Hola {nombre}, ...") por su valor real — mismo
// mecanismo "split + join" que ya usa el frontend para sustituir
// `facturaWhatsappMensaje` al enviar (PropiedadFichaDrawer.tsx::
// enviarPorWhatsapp), centralizado acá porque `AvisosService` arma el
// texto final en el BACKEND (a diferencia de Factura, donde la plantilla
// se manda cruda y el frontend la completa recién al momento de enviar).
export function aplicarPlantilla(plantilla: string, valores: Record<string, string>): string {
  return Object.entries(valores).reduce((texto, [clave, valor]) => texto.split(`{${clave}}`).join(valor), plantilla);
}
