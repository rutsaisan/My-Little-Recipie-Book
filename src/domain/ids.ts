/**
 * Identificadores únicos ordenables por fecha de creación.
 *
 * No se usa `crypto.randomUUID()` porque solo existe en contextos seguros
 * (https o localhost) y la app también debe funcionar al abrirla desde el
 * móvil por la red de casa (http://192.168.x.x). `getRandomValues` sí está
 * disponible en ambos casos.
 */
export function createId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}-${random}`;
}
