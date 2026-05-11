import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DARK  = [26, 47, 74];   // #1a2f4a
const MID   = [46, 79, 106];  // #2e4f6a
const GOLD  = [201, 168, 76]; // #c9a84c
const STRIP = [247, 243, 238];
const GRAY  = [150, 150, 150];

// Y where table content starts after a full header (no-club mode)
// top(12) + line offset(11) + gap(3) + catBlock(11) = 37
const HEADER_H_GENERAL = 37;

// Y where table content starts after a full header (por-club mode)
// Logo 25mm (y=8→33) + text rows + gold-line + separator + gap + catBlock = 46
const HEADER_H_CLUB = 46;

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

export async function generarPDF({ jugadores, clubes, torneoNombre, temporada, clubFiltroId, logoBase64 = null }) {
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const esPorClub = !!clubFiltroId;
  const clubData = esPorClub ? clubes.find(c => c.uid === clubFiltroId) : null;

  const fecha = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const categorias = [...new Set(jugadores.map(j => j.categoria).filter(Boolean))].sort();
  const HEADER_H = esPorClub ? HEADER_H_CLUB : HEADER_H_GENERAL;

  function getNombreClub(uid) {
    return clubes.find(c => c.uid === uid)?.nombre || "—";
  }

  // Pre-compute logo dimensions (async, before the sync drawing loop)
  let logoDims = null;
  if (esPorClub && logoBase64) {
    try {
      const img = new Image();
      img.src = logoBase64;
      await new Promise(resolve => { img.onload = resolve; });
      const maxSize = 20;
      const ratio = img.width / img.height;
      logoDims = {
        w: ratio >= 1 ? maxSize : maxSize * ratio,
        h: ratio >= 1 ? maxSize / ratio : maxSize,
      };
    } catch (_) {}
  }

  function drawCatBlock(y, cat) {
    doc.setFillColor(...DARK);
    doc.roundedRect(15, y, W - 30, 7, 1, 1, "F");
    doc.setFillColor(...GOLD);
    doc.rect(15, y + 7, W - 30, 1.5, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(cat.toUpperCase(), 19, y + 5);
    return y + 11;
  }

  function drawFullHeader(cat) {
    const top = 12;

    if (esPorClub) {
      // ── Por-club header: logo 25×25 + prominent club name + gold line ──
      if (logoBase64 && logoDims) {
        try {
          doc.addImage(logoBase64, "PNG", 15, 6, logoDims.w, logoDims.h, undefined, "FAST");
        } catch (err) {
          console.error("addImage error:", err);
        }
      }

      // Date — top right
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(fecha, W - 15, top, { align:"right" });

      // Torneo name — small, secondary, centered
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(torneoNombre, W / 2, top + 3, { align:"center" });

      // Club name — large, bold, dark, centered
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(clubData?.nombre || "", W / 2, top + 13, { align:"center" });

      // Gold accent line under club name
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(1.5);
      doc.line(15, top + 18, W - 15, top + 18);

      // Dark separator line (after logo ends at y=33)
      const lineY = top + 21;
      doc.setDrawColor(...DARK);
      doc.setLineWidth(0.7);
      doc.line(15, lineY, W - 15, lineY);

      return drawCatBlock(lineY + 3, cat); // → HEADER_H_CLUB ≈ 46
    } else {
      // ── General header: torneo name + temporada ───────────────────────
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(torneoNombre, W / 2, top, { align:"center" });

      if (temporada) {
        doc.setFontSize(13);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRAY);
        doc.text(temporada, W / 2, top + 7, { align:"center" });
      }

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(fecha, W - 15, top, { align:"right" });

      const lineY = top + 11;
      doc.setDrawColor(...DARK);
      doc.setLineWidth(0.7);
      doc.line(15, lineY, W - 15, lineY);

      return drawCatBlock(lineY + 3, cat); // → HEADER_H_GENERAL ≈ 37
    }
  }

  // Por club: N°(12) + Apellido(80) + DNI(32) + FechaNac(28) + Estado(28) = 180mm
  // General:  N°(12) + Apellido(57) + DNI(30) + FechaNac(26) + Club(32) + Estado(23) = 180mm
  function getColStyles() {
    return esPorClub
      ? {
          0: { cellWidth:12, halign:"center", overflow:"hidden" },
          1: { cellWidth:80, overflow:"linebreak" },
          2: { cellWidth:32, overflow:"hidden" },
          3: { cellWidth:28, overflow:"hidden" },
          4: { cellWidth:28, overflow:"hidden" },
        }
      : {
          0: { cellWidth:12, halign:"center", overflow:"hidden" },
          1: { cellWidth:57, overflow:"linebreak" },
          2: { cellWidth:30, overflow:"hidden" },
          3: { cellWidth:26, overflow:"hidden" },
          4: { cellWidth:32, overflow:"linebreak" },
          5: { cellWidth:23, overflow:"hidden" },
        };
  }

  let prevFinalY = null;

  categorias.forEach((cat) => {
    const jsCat = jugadores
      .filter(j => j.categoria === cat)
      .sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
    if (jsCat.length === 0) return;

    const columns = esPorClub
      ? ["N°", "Apellido y Nombre", "DNI", "Fecha Nac.", "Estado"]
      : ["N°", "Apellido y Nombre", "DNI", "Fecha Nac.", "Club", "Estado"];

    const rows = jsCat.map((j, i) => esPorClub
      ? [i + 1, `${j.apellido || ""}, ${j.nombre || ""}`, j.dni || "—", formatFecha(j.fechaNacimiento), estadoLabel(j.estado)]
      : [i + 1, `${j.apellido || ""}, ${j.nombre || ""}`, j.dni || "—", formatFecha(j.fechaNacimiento), getNombreClub(j.clubId), estadoLabel(j.estado)]
    );

    let startY;
    if (prevFinalY === null) {
      startY = drawFullHeader(cat);
    } else {
      const gapY = prevFinalY + 10;
      if (gapY + 20 > H - 16) {
        doc.addPage();
        startY = drawFullHeader(cat);
      } else {
        startY = drawCatBlock(gapY, cat);
      }
    }

    autoTable(doc, {
      startY,
      head: [columns],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: MID,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
        cellPadding: 3,
        minCellHeight: 8,
        valign: "middle",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: DARK,
        cellPadding: { top:2.5, bottom:2.5, left:3, right:3 },
      },
      alternateRowStyles: { fillColor: STRIP },
      columnStyles: getColStyles(),
      tableLineColor: [220, 210, 200],
      tableLineWidth: 0.2,
      margin: { top: HEADER_H, left: 15, right: 15, bottom: 16 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawFullHeader(cat);
      },
    });

    prevFinalY = doc.lastAutoTable.finalY;
  });

  // Footers — drawn after all content is placed
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    const footerY = H - 6;
    doc.text(torneoNombre, 15, footerY);
    doc.text(`Página ${p} de ${totalPages}`, W - 15, footerY, { align:"right" });
  }

  return doc;
}
