import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { urlVisualizacion } from "../../utils/drive";

const ESTADO_INFO = {
  pendiente: { bg:"#fff8e1", color:"#c9a84c", texto:"⏳ Pendiente" },
  habilitado: { bg:"#e8f5ee", color:"#1a6e4a", texto:"✅ Habilitado" },
  rechazado: { bg:"#fdecea", color:"#c0392b", texto:"❌ Rechazado" },
  baja_solicitada: { bg:"#f5f0e8", color:"#8a9eaa", texto:"📋 Baja solicitada" },
  inactivo: { bg:"#f5f0e8", color:"#444", texto:"🚫 Inactivo" },
};

export default function MisJugadores({ userData, clubData, onVolver, onReinscribir }) {
  const [jugadores, setJugadores] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const inscripcionActiva = clubData?.habilitado !== false;

  useEffect(() => { cargarJugadores(); }, [userData]);

  async function cargarJugadores() {
    if (!userData?.clubId) return;
    setLoading(true);
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), where("clubId", "==", userData.clubId)));
    setJugadores(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    setLoading(false);
  }

  async function solicitarBaja(id) {
    if (!confirm("¿Querés solicitar la baja de este jugador?")) return;
    await updateDoc(doc(db, "jugadores_carnet", id), { estado:"baja_solicitada" });
    await cargarJugadores();
  }

  const categorias = [...new Set(jugadores.map(j => j.categoria).filter(Boolean))];

  const jugadoresFiltrados = jugadores.filter(j => {
    const coincideEstado = filtroEstado ? j.estado === filtroEstado : true;
    const coincideCategoria = filtroCategoria ? j.categoria === filtroCategoria : true;
    const coincideBusqueda = busqueda ? `${j.apellido} ${j.nombre}`.toLowerCase().includes(busqueda.toLowerCase()) : true;
    return coincideEstado && coincideCategoria && coincideBusqueda;
  });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem" }}>
        <button onClick={onVolver} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#1e3a4a" }}>←</button>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>Mis jugadores</div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1rem" }}>
        <input style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box" }}
          placeholder="🔍 Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <div style={{ display:"flex", gap:8 }}>
          <select style={{ flex:1, padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="habilitado">Habilitado</option>
            <option value="rechazado">Rechazado</option>
            <option value="baja_solicitada">Baja solicitada</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select style={{ flex:1, padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
            value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {!inscripcionActiva && (
        <div style={{ background:"#fdecea", border:"1.5px solid #c0392b", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#c0392b", marginBottom:"1rem" }}>
          🔒 La inscripción está cerrada. No podés realizar modificaciones.
        </div>
      )}

      {loading && <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>Cargando...</div>}
      {!loading && jugadoresFiltrados.length === 0 && (
        <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem", background:"white", borderRadius:12, border:"1px solid #ede5d5" }}>
          No hay jugadores con ese filtro.
        </div>
      )}

      {jugadoresFiltrados.map(j => {
        const estado = ESTADO_INFO[j.estado] || ESTADO_INFO.pendiente;
        return (
          <div key={j.id} style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", padding:"1rem", marginBottom:"0.75rem" }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{ width:50, height:67, borderRadius:6, overflow:"hidden", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid #ede5d5" }}>
                {j.fotoCarnetUrl ? <img src={urlVisualizacion(j.fotoCarnetUrl)} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:20 }}>👤</span>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600, color:"#1e3a4a" }}>{j.apellido}, {j.nombre}</div>
                <div style={{ fontSize:12, color:"#8a9eaa", marginTop:2 }}>DNI: {j.dni} · Nac: {j.fechaNacimiento ? j.fechaNacimiento.split("-").reverse().join("/") : "—"}</div>
                <div style={{ fontSize:12, color:"#4a6070", marginTop:2 }}>Categoría: {j.categoria || "—"}</div>
                {j.motivoRechazo && (
                  <div style={{ fontSize:12, color:"#c0392b", marginTop:6, background:"#fdecea", borderRadius:6, padding:"4px 8px" }}>
                    Motivo: {j.motivoRechazo}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                <span style={{ background:estado.bg, color:estado.color, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
                  {estado.texto}
                </span>
                {j.estado === "rechazado" && inscripcionActiva && (
                  <button
                    onClick={() => onReinscribir(j)}
                    style={{ background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}
                  >
                    🔄 Reinscribir
                  </button>
                )}
                {j.estado === "habilitado" && inscripcionActiva && (
                  <button
                    onClick={() => solicitarBaja(j.id)}
                    style={{ background:"none", border:"1px solid #c0392b", color:"#c0392b", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}
                  >
                    Solicitar baja
                  </button>
                )}
                {j.estado === "inactivo" && inscripcionActiva && (
                  <button
                    onClick={() => updateDoc(doc(db, "jugadores_carnet", j.id), { estado:"reactivacion_solicitada" }).then(cargarJugadores)}
                    style={{ background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}
                  >
                    🔄 Solicitar reactivación
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
