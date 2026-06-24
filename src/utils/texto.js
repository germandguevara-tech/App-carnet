export function normalizarTexto(texto) {
  if (!texto) return "";
  return texto
    .toUpperCase()
    .replace(/,/g, "")
    .trim()
    .replace(/\s+/g, " ");
}
