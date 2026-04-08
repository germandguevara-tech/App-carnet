import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { urlVisualizacion } from "../../utils/drive";
import { descargarExcel } from "../../utils/excel";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";

const estilos = {
  titulo: { fontSize:24, fontWeight:600, color:"#1e3a4a", marginBottom:"1.5rem" },
  card: { background:"white", borderRadius:14, padding:"1.25rem", marginBottom:"0.75rem", border:"1px solid #ede5d5" },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnVerde: { background:"#1a6e4a", color:"white", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
  btnRojo: { background:"#c0392b", color:"white", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
  btnGold: { background:"#c9a84c", color:"white", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
  btnGris: { background:"#8a9eaa", color:"white", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" },
  input: { padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none" },
  label: { fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 },
  select: { padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", background:"white" },
};

const ESTADOS_COLORES = {
  pendiente: "#c9a84c",
  habilitado: "#1a6e4a",
  rechazado: "#c0392b",
  baja_solicitada: "#8a9eaa",
  inactivo: "#444"
};

const MOTIVOS_RECHAZO = [
  "Foto carnet no coincide con el documento",
  "Foto del DNI borrosa o ilegible",
  "Datos no coinciden con el documento",
  "Foto carnet de cuerpo entero (debe ser busto)",
  "Fondo de foto carnet inadecuado",
  "Otro motivo"
];

export default function Inscriptos() {
  const [jugadores, setJugadores] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [torneoFiltro, setTorneoFiltro] = useState("");
  const [clubFiltro, setClubFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("pendiente");
  const [loading, setLoading] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  useEffect(() => { cargarFiltros(); }, []);
  useEffect(() => { if(torneoFiltro) cargarJugadores(); }, [torneoFiltro, clubFiltro, estadoFiltro]);

  async function cargarFiltros() {
    const snapT = await getDocs(collection(db, "torneos_carnet"));
    const listaTorneos = snapT.docs.map(d => ({ id:d.id, ...d.data() }));
    setTorneos(listaTorneos);
    const activo = listaTorneos.find(t => t.estado === "activo");
    if(activo) setTorneoFiltro(activo.id);
    const snapC = await getDocs(collection(db, "clubes_carnet"));
    setClubes(snapC.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  async function cargarJugadores() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), orderBy("creadoEn", "desc")));
    let lista = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(torneoFiltro) lista = lista.filter(j => j.torneoId === torneoFiltro);
    if(clubFiltro) lista = lista.filter(j => j.clubId === clubFiltro);
    if(estadoFiltro) lista = lista.filter(j => j.estado === estadoFiltro);
    setJugadores(lista);
    setLoading(false);
  }

  async function cambiarEstado(id, estado, motivo="") {
    await updateDoc(doc(db, "jugadores_carnet", id), { estado, motivoRechazo: motivo, revisadoEn: new Date() });
    await cargarJugadores();
  }

  function getNombreClub(id) {
    return clubes.find(c => c.uid === id)?.nombre || "—";
  }

  function abrirModalRechazo(jugador) {
    setModalRechazo(jugador);
    setMotivoRechazo(MOTIVOS_RECHAZO[0]);
  }

  async function confirmarRechazo() {
    await cambiarEstado(modalRechazo.id, "rechazado", motivoRechazo);
    setModalRechazo(null);
  }

  async function handleDescargarExcel() {
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), orderBy("creadoEn", "desc")));
    let lista = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (torneoFiltro) lista = lista.filter(j => j.torneoId === torneoFiltro);
    if (clubFiltro) lista = lista.filter(j => j.clubId === clubFiltro);
    if (estadoFiltro) lista = lista.filter(j => j.estado === estadoFiltro);

    const listaConNombres = lista.map(j => ({
      ...j,
      clubNombre: clubes.find(c => c.uid === j.clubId)?.nombre || "",
      torneoNombre: torneos.find(t => t.id === j.torneoId)?.nombre || "",
    }));

    const torneoNombre = torneos.find(t => t.id === torneoFiltro)?.nombre || "todos";
    descargarExcel(listaConNombres, `Inscriptos-${torneoNombre}`);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={estilos.titulo}>👥 Inscriptos</div>
        <button style={{ background:"#1a6e4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }} onClick={handleDescargarExcel}>
          📥 Descargar Excel
        </button>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:"1.5rem", flexWrap:"wrap" }}>
        <div>
          <label style={estilos.label}>Torneo</label>
          <select style={estilos.select} value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}>
            {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={estilos.label}>Club</label>
          <select style={estilos.select} value={clubFiltro} onChange={e => setClubFiltro(e.target.value)}>
            <option value="">Todos los clubes</option>
            {clubes.map(c => <option key={c.id} value={c.uid}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={estilos.label}>Estado</label>
          <select style={estilos.select} value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="habilitado">Habilitado</option>
            <option value="rechazado">Rechazado</option>
            <option value="baja_solicitada">Baja solicitada</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>Cargando...</div>}

      {!loading && jugadores.length === 0 && (
        <div style={{ ...estilos.card, textAlign:"center", color:"#8a9eaa", padding:"3rem" }}>
          No hay jugadores con ese filtro.
        </div>
      )}

      {jugadores.map(j => (
        <div key={j.id} style={estilos.card}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:50, height:67, borderRadius:6, border:"1px solid #ede5d5", overflow:"hidden", flexShrink:0, background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {j.fotoCarnetUrl ? (
                <img src={urlVisualizacion(j.fotoCarnetUrl)} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <span style={{ fontSize:20 }}>👤</span>
              )}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:"#1e3a4a" }}>{j.apellido}, {j.nombre}</div>
              <div style={{ fontSize:12, color:"#8a9eaa" }}>DNI: {j.dni} · Nac: {j.fechaNacimiento}</div>
              <div style={{ fontSize:12, color:"#4a6070" }}>Club: {getNombreClub(j.clubId)} · Cat: {j.categoria}</div>
              {j.motivoRechazo && <div style={{ fontSize:11, color:"#c0392b", marginTop:4, background:"#fdecea", borderRadius:4, padding:"2px 6px", display:"inline-block" }}>{j.motivoRechazo}</div>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:10, color:"#8a9eaa" }}>
                  {j.creadoEn?.toDate ? j.creadoEn.toDate().toLocaleDateString("es-AR") : ""}
                </span>
                <span style={{ background: ESTADOS_COLORES[j.estado] || "#8a9eaa", color:"white", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>
                  {j.estado}
                </span>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {j.estado === "pendiente" && <>
                  <button title="Habilitar" style={{ width:32, height:32, background:"#1a6e4a", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "habilitado")}>✓</button>
                  <button title="Rechazar" style={{ width:32, height:32, background:"#c0392b", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => abrirModalRechazo(j)}>✕</button>
                </>}
                {j.estado === "habilitado" && <>
                  <button title="Volver a pendiente" style={{ width:32, height:32, background:"#c9a84c", color:"white", border:"none", borderRadius:6, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "pendiente")}>P</button>
                  <button title="Rechazar" style={{ width:32, height:32, background:"#c0392b", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => abrirModalRechazo(j)}>✕</button>
                </>}
                {j.estado === "rechazado" && <>
                  <button title="Volver a pendiente" style={{ width:32, height:32, background:"#c9a84c", color:"white", border:"none", borderRadius:6, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "pendiente")}>P</button>
                  <button title="Habilitar" style={{ width:32, height:32, background:"#1a6e4a", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "habilitado")}>✓</button>
                </>}
                {j.estado === "baja_solicitada" && <>
                  <button title="Denegar baja" style={{ width:32, height:32, background:"#1a6e4a", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "habilitado")}>✓</button>
                  <button title="Confirmar baja" style={{ width:32, height:32, background:"#8a9eaa", color:"white", border:"none", borderRadius:6, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => cambiarEstado(j.id, "inactivo")}>✕</button>
                </>}
              </div>
            </div>
          </div>
        </div>
      ))}

      {modalRechazo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"white", borderRadius:16, padding:"2rem", width:"100%", maxWidth:480 }}>
            <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a", marginBottom:"1rem" }}>Motivo de rechazo</div>
            <div style={{ fontSize:14, color:"#4a6070", marginBottom:"1rem" }}>
              Jugador: <strong>{modalRechazo.apellido}, {modalRechazo.nombre}</strong>
            </div>
            <select style={{ ...estilos.select, width:"100%", marginBottom:"1rem" }} value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}>
              {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ display:"flex", gap:10 }}>
              <button style={estilos.btnRojo} onClick={confirmarRechazo}>Confirmar rechazo</button>
              <button style={estilos.btnGris} onClick={() => setModalRechazo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
