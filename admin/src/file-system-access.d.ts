// Tipos mínimos de la File System Access API (Chrome/Edge) — no vienen en
// el `lib.dom.d.ts` que trae TypeScript todavía (sigue sin ser parte del
// DOM estándar que TS tipa de fábrica), así que se declaran acá a mano en
// vez de agregar una dependencia aparte solo por esto. Usada por
// `lib/pdfComprobante.ts::guardarPdfComprobante()` (pedido del usuario
// 2026-10-15: "que me deje seleccionar la ruta donde se descargue el
// archivo"). Si el navegador no la soporta (Firefox, Safari), `Window.
// showSaveFilePicker` queda `undefined` — el código que lo llama ya hace
// `'showSaveFilePicker' in window` antes, así que no hace falta que estos
// tipos cubran el caso "no existe", solo el caso "si existe, así se usa".

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: SaveFilePickerAcceptType[];
}

interface Window {
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
