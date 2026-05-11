import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { generarReporteHTML } from "../../utils/reporteHTML";

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

function extraerFileId(url) {
  if (!url) return null;
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function cargarLogoBase64(logoUrl) {
  const fileId = extraerFileId(logoUrl);
  if (!fileId) return null;
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "obtenerImagenBase64", fileId }),
    });
    const data = await resp.json();
    if (data.error) { console.error("Logo proxy error:", data.error); return null; }
    return `data:${data.mimeType};base64,${data.base64}`;
  } catch (err) {
    console.error("cargarLogoBase64 error:", err);
    return null;
  }
}

const s = {
  label: { fontSize:11, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:4 },
  select: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", background:"white" },
  btn: (color) => ({ background:color, color:"white", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }),
};

export default function ModalReporte({ onClose, torneos, clubes, defaultTorneoId, defaultClubId, defaultEstado, defaultCategoria }) {
  const [torneoId, setTorneoId]     = useState(defaultTorneoId || "");
  const [clubId, setClubId]         = useState(defaultClubId || "");
  const [categoria, setCategoria]   = useState(defaultCategoria || "");
  const [estado, setEstado]         = useState(defaultEstado && !["duplicado_entre_clubes","fuera_de_categoria"].includes(defaultEstado) ? defaultEstado : "");
  const [jugadoresTodos, setJugadoresTodos] = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [generando, setGenerando]   = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const iframeRef = useRef(null);

  useEffect(() => { if (torneoId) fetchJugadores(); }, [torneoId]);

  async function fetchJugadores() {
    setCargando(true);
    try {
      const snap = await getDocs(query(
        collection(db, "jugadores_carnet"),
        where("torneoId", "==", torneoId)
      ));
      setJugadoresTodos(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch(e) { /* ignore */ }
    setCargando(false);
  }

  function getJugadoresFiltrados() {
    let lista = [...jugadoresTodos];
    if (clubId)    lista = lista.filter(j => j.clubId    === clubId);
    if (categoria) lista = lista.filter(j => j.categoria === categoria);
    if (estado)    lista = lista.filter(j => j.estado    === estado);
    return lista;
  }

  function getTorneoNombre() {
    return torneos.find(t => t.id === torneoId)?.nombre || "";
  }

  function buildHTML(logoBase64 = null) {
    return generarReporteHTML({
      jugadores: getJugadoresFiltrados(),
      clubes,
      torneoNombre: getTorneoNombre(),
      temporada: new Date().getFullYear().toString(),
      clubFiltroId: clubId || null,
      logoBase64,
    });
  }

  async function handleVistaPrevia() {
    const clubSeleccionado = clubId ? clubes.find(c => c.uid === clubId) : null;
    const logoBase64 = clubSeleccionado?.logoUrl
      ? await cargarLogoBase64(clubSeleccionado.logoUrl)
      : null;
    setPreviewHTML(buildHTML(logoBase64));
    setVistaPrevia(true);
  }

  async function handlePDF() {
    setGenerando(true);
    try {
      const clubSeleccionado = clubId ? clubes.find(c => c.uid === clubId) : null;
      const logoBase64 = clubSeleccionado?.logoUrl
        ? await cargarLogoBase64(clubSeleccionado.logoUrl)
        : null;

      const { generarPDF } = await import("../../utils/reportePDF");
      const doc = await generarPDF({
        jugadores: getJugadoresFiltrados(),
        clubes,
        torneoNombre: getTorneoNombre(),
        temporada: new Date().getFullYear().toString(),
        clubFiltroId: clubId || null,
        logoBase64,
      });
      const nombre = `Reporte-${getTorneoNombre().replace(/\s+/g,"-")}-${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.pdf`;
      doc.save(nombre);
    } catch(e) { alert("Error al generar PDF: " + e.message); }
    setGenerando(false);
  }

  const categoriasFiltradas = [...new Set(
    jugadoresTodos
      .filter(j => clubId ? j.clubId === clubId : true)
      .filter(j => estado ? j.estado === estado : true)
      .map(j => j.categoria).filter(Boolean)
  )].sort();

  const clubesFiltrados = clubes.filter(c =>
    jugadoresTodos.some(j => j.clubId === c.uid)
  );

  const total = getJugadoresFiltrados().length;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"1rem" }}>

      {!vistaPrevia ? (
        /* ── Panel de filtros ─────────────────────────────────────────── */
        <div style={{ background:"white", borderRadius:16, width:"100%", maxWidth:520 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 1.5rem", borderBottom:"1px solid #ede5d5" }}>
            <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a" }}>🖨️ Generar reporte</div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#8a9eaa", lineHeight:1 }}>×</button>
          </div>

          <div style={{ padding:"1.25rem 1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
            <div>
              <label style={s.label}>Torneo</label>
              <select style={s.select} value={torneoId} onChange={e => { setTorneoId(e.target.value); setClubId(""); setCategoria(""); }}>
                <option value="">— Seleccioná —</option>
                {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>

            <div>
              <label style={s.label}>Club</label>
              <select style={s.select} value={clubId} onChange={e => { setClubId(e.target.value); setCategoria(""); }} disabled={!torneoId || cargando}>
                <option value="">Todos los clubes</option>
                {clubesFiltrados.map(c => <option key={c.uid} value={c.uid}>{c.nombre}</option>)}
              </select>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={s.label}>Categoría</label>
                <select style={s.select} value={categoria} onChange={e => setCategoria(e.target.value)} disabled={!torneoId || cargando}>
                  <option value="">Todas</option>
                  {categoriasFiltradas.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Estado</label>
                <select style={s.select} value={estado} onChange={e => setEstado(e.target.value)} disabled={!torneoId || cargando}>
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="habilitado">Habilitado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="baja_solicitada">Baja solicitada</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Resumen */}
            <div style={{ background:"#f5f0e8", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#4a6070", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>{cargando ? "Cargando datos..." : `${total} jugador${total !== 1 ? "es" : ""} en el reporte`}</span>
              {!cargando && total > 0 && (
                <span style={{ fontSize:11, color:"#8a9eaa" }}>
                  {[...new Set(getJugadoresFiltrados().map(j => j.categoria).filter(Boolean))].length} categoría{[...new Set(getJugadoresFiltrados().map(j => j.categoria).filter(Boolean))].length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div style={{ padding:"1rem 1.5rem 1.5rem", borderTop:"1px solid #ede5d5", display:"flex", gap:8, flexWrap:"wrap" }}>
            <button
              style={{ ...s.btn("#1e3a4a"), opacity: (!torneoId || cargando || total === 0) ? 0.5 : 1 }}
              onClick={handleVistaPrevia}
              disabled={!torneoId || cargando || total === 0}
            >
              🔍 Vista previa
            </button>
            <button
              style={{ ...s.btn("#c0392b"), opacity: (!torneoId || cargando || total === 0 || generando) ? 0.5 : 1 }}
              onClick={handlePDF}
              disabled={!torneoId || cargando || total === 0 || generando}
            >
              {generando ? "Generando..." : "📄 PDF"}
            </button>
          </div>
        </div>

      ) : (
        /* ── Vista previa ─────────────────────────────────────────────── */
        <div style={{ background:"white", borderRadius:16, width:"100%", maxWidth:960, height:"90vh", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid #ede5d5", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button
                onClick={() => setVistaPrevia(false)}
                style={{ background:"none", border:"1px solid #ede5d5", borderRadius:8, padding:"6px 14px", fontSize:13, cursor:"pointer", color:"#4a6070" }}
              >
                ← Volver
              </button>
              <div style={{ fontSize:15, fontWeight:600, color:"#1e3a4a" }}>Vista previa — {getTorneoNombre()}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button
                style={{ ...s.btn("#c0392b"), opacity: generando ? 0.6 : 1 }}
                onClick={handlePDF}
                disabled={generando}
              >
                {generando ? "..." : "📄 PDF"}
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={previewHTML}
            style={{ flex:1, border:"none", borderRadius:"0 0 16px 16px" }}
            title="Vista previa del reporte"
          />
        </div>
      )}
    </div>
  );
}
