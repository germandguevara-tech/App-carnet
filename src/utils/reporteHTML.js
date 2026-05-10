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

export function generarReporteHTML({ jugadores, clubes, torneoNombre, temporada, clubFiltroId }) {
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

  const headerImg = esPorClub && clubData?.logoUrl
    ? `<img class="logo-header" src="${urlVisualizacion(clubData.logoUrl, 120)}" onerror="this.style.display='none'" />`
    : `<div class="logo-placeholder">⚽</div>`;

  const headerHTML = (cat) => `
    <div class="page-header">
      <div class="ph-left">${headerImg}</div>
      <div class="ph-center">
        <div class="ph-torneo">${torneoNombre}</div>
        ${temporada ? `<div class="ph-temp">${temporada}</div>` : ""}
        ${esPorClub ? `<div class="ph-club">${clubData?.nombre || ""}</div>` : ""}
      </div>
      <div class="ph-right">
        <div class="ph-fecha-label">Generado el</div>
        <div class="ph-fecha">${fecha}</div>
      </div>
    </div>
    <div class="header-line"></div>
    <div class="cat-block">
      <div class="cat-title">${cat}</div>
      <div class="cat-accent"></div>
    </div>`;

  const tableHeader = esPorClub
    ? `<tr><th class="th-n">N°</th><th>Apellido y Nombre</th><th>DNI</th><th>Fecha Nac.</th><th>Estado</th></tr>`
    : `<tr><th class="th-n">N°</th><th>Apellido y Nombre</th><th>DNI</th><th>Fecha Nac.</th><th>Club</th><th>Estado</th></tr>`;

  let sections = "";
  let globalN = 0;

  categorias.forEach((cat, idx) => {
    const jsCat = jugadores
      .filter(j => j.categoria === cat)
      .sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
    if (jsCat.length === 0) return;

    const rows = jsCat.map((j, i) => {
      globalN++;
      const logoClub = !esPorClub ? getLogoClub(j.clubId) : null;
      const evenOdd = i % 2 === 0 ? "odd" : "even";
      const clubCell = esPorClub ? "" : `<td class="td-club">
        ${logoClub ? `<img class="escudo" src="${logoClub}" onerror="this.style.display='none'" />` : ""}
        ${getNombreClub(j.clubId)}
      </td>`;
      return `<tr class="${evenOdd}">
        <td class="td-n">${i + 1}</td>
        <td class="td-nombre"><strong>${j.apellido || ""}</strong>, ${j.nombre || ""}</td>
        <td class="td-dni">${j.dni || "—"}</td>
        <td class="td-fecha">${formatFecha(j.fechaNacimiento)}</td>
        ${clubCell}
        <td class="td-estado"><span class="badge estado-${j.estado}">${estadoLabel(j.estado)}</span></td>
      </tr>`;
    }).join("");

    const pageBreak = idx < categorias.length - 1 ? ' page-break' : '';

    sections += `<section class="page-section${pageBreak}">
      ${headerHTML(cat)}
      <table>
        <thead>${tableHeader}</thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="section-footer">
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
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a2f4a; background: white; }

  .page-section { padding: 12mm 12mm 10mm; }

  /* Page header */
  .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .ph-left { width: 72px; flex-shrink: 0; }
  .ph-center { flex: 1; text-align: center; }
  .ph-right { width: 90px; text-align: right; flex-shrink: 0; }
  .logo-header { width: 60px; height: 60px; object-fit: contain; }
  .logo-placeholder { width: 52px; height: 52px; background: #e8d5a0; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 22px; }
  .ph-torneo { font-size: 17px; font-weight: 700; color: #1a2f4a; line-height: 1.2; }
  .ph-temp { font-size: 11px; color: #666; margin-top: 2px; }
  .ph-club { font-size: 12px; font-weight: 600; color: #1a2f4a; margin-top: 3px; }
  .ph-fecha-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
  .ph-fecha { font-size: 10px; color: #666; font-weight: 600; margin-top: 2px; }

  .header-line { height: 2.5px; background: #1a2f4a; margin-bottom: 10px; border-radius: 1px; }

  /* Category block */
  .cat-block { margin-bottom: 6px; }
  .cat-title { background: #1a2f4a; color: white; padding: 6px 12px;
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    border-radius: 4px 4px 0 0; }
  .cat-accent { height: 3px; background: #c9a84c; border-radius: 0 0 2px 2px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
  thead th { background: #2e4f6a; color: white; padding: 6px 8px;
    text-align: left; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #1a3a52; }
  .th-n { width: 28px; text-align: center; }

  tbody tr.odd { background: white; }
  tbody tr.even { background: #f7f3ee; }
  tbody tr td { padding: 6px 8px; border: 1px solid #e0d8ce; vertical-align: middle; }
  .td-n { text-align: center; color: #8a9eaa; font-size: 9px; width: 28px; }
  .td-nombre { font-size: 10.5px; }
  .td-dni { white-space: nowrap; width: 75px; }
  .td-fecha { white-space: nowrap; width: 70px; }
  .td-club { width: 130px; }
  .td-estado { width: 80px; }
  .club-cell { display: flex; align-items: center; gap: 5px; }
  .escudo { width: 16px; height: 16px; object-fit: contain; flex-shrink: 0; vertical-align: middle; margin-right: 4px; }

  /* Estado badges */
  .badge { display: inline-block; padding: 2px 7px; border-radius: 3px;
    font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
  .estado-habilitado      { background: #e8f5ee; color: #1a6e4a; }
  .estado-pendiente       { background: #fff8e1; color: #b8860b; }
  .estado-rechazado       { background: #fdecea; color: #c0392b; }
  .estado-inactivo        { background: #f0f0f0; color: #555; }
  .estado-baja_solicitada { background: #f5f0e8; color: #8a9eaa; }
  .estado-reactivacion_solicitada { background: #e8f0ff; color: #2563eb; }

  /* Section footer */
  .section-footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #e0d8ce;
    font-size: 9px; color: #999; display: flex; justify-content: space-between; }

  /* Page break */
  .page-break { page-break-after: always; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-section { padding: 0; }
    table thead { display: table-header-group; }
    tr { page-break-inside: avoid; }

    @page {
      size: A4 portrait;
      margin: 12mm 10mm 16mm;
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
