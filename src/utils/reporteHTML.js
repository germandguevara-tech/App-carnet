function urlVisualizacion(urlDrive, sz = 80) {
  if (!urlDrive) return "";
  const m1 = urlDrive.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w${sz}`;
  const m2 = urlDrive.match(/id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w${sz}`;
  return urlDrive;
}

function formatFecha(f) {
  if (!f) return "—";
  return f.split("-").reverse().join("/");
}

function estadoLabel(e) {
  const map = {
    habilitado: "Habilitado", pendiente: "Pendiente", rechazado: "Rechazado",
    inactivo: "Inactivo", baja_solicitada: "Baja solicitada",
    reactivacion_solicitada: "Reactivación",
  };
  return map[e] || e || "—";
}

export function generarReporteHTML({ jugadores, clubes, torneoNombre, temporada, clubFiltroId, logoBase64 = null }) {
  const esPorClub = !!clubFiltroId;
  const clubData = esPorClub ? clubes.find(c => c.uid === clubFiltroId) : null;
  const fecha = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });

  const categorias = [...new Set(jugadores.map(j => j.categoria).filter(Boolean))].sort();

  function getNombreClub(uid) {
    return clubes.find(c => c.uid === uid)?.nombre || "—";
  }
  function getLogoClub(uid) {
    const c = clubes.find(c => c.uid === uid);
    return c?.logoUrl ? urlVisualizacion(c.logoUrl, 60) : null;
  }

  const headerHTML = (cat) => `
    ${esPorClub && logoBase64 ? `<div style="text-align:center;margin-bottom:8px"><img src="${logoBase64}" style="height:50px;object-fit:contain"></div>` : ""}
    <h2>${torneoNombre}</h2>
    ${temporada ? `<p class="subtitulo">${temporada}</p>` : ""}
    ${esPorClub && clubData?.nombre ? `<p class="subtitulo">${clubData.nombre}</p>` : ""}
    <p class="fecha">${fecha}</p>
    <p class="categoria">${cat.toUpperCase()}</p>`;

  // colgroup para 5 columnas (por club) o 6 columnas (general)
  const colgroup = esPorClub
    ? `<colgroup>
        <col class="num">
        <col class="nombre">
        <col class="dni">
        <col class="fecha-col">
        <col class="estado">
      </colgroup>`
    : `<colgroup>
        <col class="num">
        <col class="nombre">
        <col class="dni">
        <col class="fecha-col">
        <col class="club">
        <col class="estado">
      </colgroup>`;

  const tableHeader = esPorClub
    ? `<tr><th>N°</th><th>Apellido y Nombre</th><th>DNI</th><th>Fecha Nac.</th><th>Estado</th></tr>`
    : `<tr><th>N°</th><th>Apellido y Nombre</th><th>DNI</th><th>Fecha Nac.</th><th>Club</th><th>Estado</th></tr>`;

  let sections = "";

  categorias.forEach((cat, idx) => {
    const jsCat = jugadores
      .filter(j => j.categoria === cat)
      .sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
    if (jsCat.length === 0) return;

    const rows = jsCat.map((j, i) => {
      const logoClub = !esPorClub ? getLogoClub(j.clubId) : null;
      const clubCell = esPorClub ? "" : `<td>
        ${logoClub ? `<img class="escudo" src="${logoClub}" onerror="this.style.display='none'" />` : ""}
        ${getNombreClub(j.clubId)}
      </td>`;
      return `<tr>
        <td style="text-align:center;color:#8a9eaa">${i + 1}</td>
        <td><strong>${j.apellido || ""}</strong>, ${j.nombre || ""}</td>
        <td>${j.dni || "—"}</td>
        <td>${formatFecha(j.fechaNacimiento)}</td>
        ${clubCell}
        <td><span class="badge estado-${j.estado}">${estadoLabel(j.estado)}</span></td>
      </tr>`;
    }).join("");

    const pageBreak = idx < categorias.length - 1 ? ' page-break' : '';

    sections += `<section class="page-section${pageBreak}">
      ${headerHTML(cat)}
      <table>
        ${colgroup}
        <thead>${tableHeader}</thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <span>${esPorClub ? (clubData?.nombre || "") + " · " : ""}${torneoNombre}</span>
        <span>${jsCat.length} jugador${jsCat.length !== 1 ? "es" : ""}</span>
      </div>
    </section>`;
  });

  if (categorias.length === 0 || jugadores.length === 0) {
    sections = `<section class="page-section"><p style="padding:2rem;color:#666;text-align:center">No hay jugadores para los filtros seleccionados.</p></section>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte — ${torneoNombre}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 15mm; }
  h2 { text-align: center; color: #1a2f4a; margin: 4px 0; }
  .subtitulo { text-align: center; font-size: 11pt; margin: 2px 0; }
  .fecha { text-align: right; font-size: 8pt; color: #666; }
  .categoria {
    background: #1a2f4a; color: white;
    padding: 5px 10px; font-size: 10pt;
    font-weight: bold; margin-top: 12px; margin-bottom: 0;
  }
  table {
    width: 100%; border-collapse: collapse;
    table-layout: fixed; font-size: 9pt;
  }
  col.num      { width: 7%; }
  col.nombre   { width: 35%; }
  col.dni      { width: 18%; }
  col.fecha-col { width: 16%; }
  col.estado   { width: 16%; }
  col.club     { width: 16%; }
  th {
    background: #2a4f6a; color: white;
    padding: 4px 6px; text-align: left; font-size: 9pt;
  }
  td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
  tr:nth-child(even) { background: #f5f5f5; }
  .footer { font-size: 8pt; color: #666; margin-top: 8px;
    display: flex; justify-content: space-between; }

  /* Estado badges */
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px;
    font-size: 8pt; font-weight: 700; }
  .estado-habilitado           { background: #e8f5ee; color: #1a6e4a; }
  .estado-pendiente            { background: #fff8e1; color: #b8860b; }
  .estado-rechazado            { background: #fdecea; color: #c0392b; }
  .estado-inactivo             { background: #f0f0f0; color: #555; }
  .estado-baja_solicitada      { background: #f5f0e8; color: #8a9eaa; }
  .estado-reactivacion_solicitada { background: #e8f0ff; color: #2563eb; }

  .escudo { width: 14px; height: 14px; object-fit: contain; vertical-align: middle; margin-right: 3px; }

  .page-break { page-break-after: always; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { background-color: #2a4f6a !important; color: white !important; }
    table thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    @page {
      size: A4 portrait;
      margin: 15mm;
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-size: 8pt; color: #999; font-family: Arial, sans-serif;
      }
    }
  }
</style>
</head>
<body>
${sections}
</body>
</html>`;
}
