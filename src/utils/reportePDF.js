import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DARK  = [26, 47, 74];   // #1a2f4a
const MID   = [46, 79, 106];  // #2e4f6a
const GOLD  = [201, 168, 76]; // #c9a84c
const STRIP = [247, 243, 238];
const GRAY  = [150, 150, 150];

function formatFecha(f) {
  if (!f) return "—";
  return f.split("-").reverse().join("/");
}

function estadoLabel(e) {
  const map = {
    habilitado:"Habilitado", pendiente:"Pendiente", rechazado:"Rechazado",
    inactivo:"Inactivo", baja_solicitada:"Baja", reactivacion_solicitada:"Reactivación",
  };
  return map[e] || e || "—";
}

export function generarPDF({ jugadores, clubes, torneoNombre, temporada, clubFiltroId }) {
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const esPorClub = !!clubFiltroId;
  const clubData = esPorClub ? clubes.find(c => c.uid === clubFiltroId) : null;

  const fecha = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const categorias = [...new Set(jugadores.map(j => j.categoria).filter(Boolean))].sort();

  function getNombreClub(uid) {
    return clubes.find(c => c.uid === uid)?.nombre || "—";
  }

  function drawPageHeader(doc, cat) {
    const top = 12;

    // Torneo name centrado
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(torneoNombre, W / 2, top, { align:"center" });

    // Temporada o club nombre
    if (esPorClub && clubData?.nombre) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(clubData.nombre, W / 2, top + 5, { align:"center" });
    } else if (temporada) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(temporada, W / 2, top + 5, { align:"center" });
    }

    // Fecha a la derecha
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(fecha, W - 12, top, { align:"right" });

    // Línea separadora
    const lineY = top + 8;
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.7);
    doc.line(12, lineY, W - 12, lineY);

    // Bloque categoría
    const catY = lineY + 3;
    doc.setFillColor(...DARK);
    doc.roundedRect(12, catY, W - 24, 7, 1, 1, "F");
    doc.setFillColor(...GOLD);
    doc.rect(12, catY + 7, W - 24, 1.5, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(cat.toUpperCase(), 16, catY + 5);

    return catY + 11; // Y after the category block
  }

  categorias.forEach((cat, idx) => {
    if (idx > 0) doc.addPage();

    const jsCat = jugadores
      .filter(j => j.categoria === cat)
      .sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));

    if (jsCat.length === 0) return;

    const startY = drawPageHeader(doc, cat);

    const columns = esPorClub
      ? ["N°", "Apellido y Nombre", "DNI", "Fecha Nac.", "Estado"]
      : ["N°", "Apellido y Nombre", "DNI", "Fecha Nac.", "Club", "Estado"];

    const rows = jsCat.map((j, i) => esPorClub
      ? [i + 1, `${j.apellido || ""}, ${j.nombre || ""}`, j.dni || "—", formatFecha(j.fechaNacimiento), estadoLabel(j.estado)]
      : [i + 1, `${j.apellido || ""}, ${j.nombre || ""}`, j.dni || "—", formatFecha(j.fechaNacimiento), getNombreClub(j.clubId), estadoLabel(j.estado)]
    );

    const colStyles = esPorClub
      ? { 0:{cellWidth:10,halign:"center"}, 2:{cellWidth:22}, 3:{cellWidth:22}, 4:{cellWidth:26} }
      : { 0:{cellWidth:10,halign:"center"}, 2:{cellWidth:22}, 3:{cellWidth:22}, 4:{cellWidth:38}, 5:{cellWidth:26} };

    autoTable(doc, {
      startY,
      head: [columns],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: MID,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: "bold",
        cellPadding: { top:4, bottom:4, left:5, right:5 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: DARK,
        cellPadding: { top:4, bottom:4, left:5, right:5 },
      },
      alternateRowStyles: { fillColor: STRIP },
      columnStyles: colStyles,
      tableLineColor: [220, 210, 200],
      tableLineWidth: 0.2,
      margin: { top: startY, left: 12, right: 12, bottom: 16 },
      didDrawPage: (_data) => {
        // Redraw header on subsequent pages of the same category
        drawPageHeader(doc, cat);
      },
    });
  });

  // Add footers after all pages are drawn
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    const footerY = H - 6;
    doc.text(torneoNombre, 12, footerY);
    doc.text(`Página ${p} de ${totalPages}`, W - 12, footerY, { align:"right" });
  }

  return doc;
}
