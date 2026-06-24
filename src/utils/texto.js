export function normalizarTexto(texto) {
  if (!texto) return "";
  return texto
    .toUpperCase()
    .replace(/,/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizarDNI(dni) {
  if (!dni) return "";
  return dni.replace(/\./g, "").replace(/\s/g, "").trim();
}
