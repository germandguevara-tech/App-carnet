import * as XLSX from "xlsx";

export function descargarExcel(jugadores, nombreArchivo) {
  const datos = jugadores.map(j => ({
    "Apellido": j.apellido || "",
    "Nombre": j.nombre || "",
    "DNI": j.dni || "",
    "Fecha Nacimiento": j.fechaNacimiento || "",
    "Categoría": j.categoria || "",
    "Club": j.clubNombre || "",
    "Torneo": j.torneoNombre || "",
    "Estado": j.estado || "",
    "Fecha Inscripción": j.creadoEn?.toDate ? j.creadoEn.toDate().toLocaleDateString("es-AR") : "",
    "Foto Carnet (Drive)": j.fotoCarnetUrl || "",
    "Foto DNI Frente (Drive)": j.fotoDniFrente || "",
    "Foto DNI Dorso (Drive)": j.fotoDniDorso || "",
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inscriptos");

  const colWidths = [
    { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 14 },
    { wch: 16 }, { wch: 50 }, { wch: 50 }, { wch: 50 }
  ];
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}
