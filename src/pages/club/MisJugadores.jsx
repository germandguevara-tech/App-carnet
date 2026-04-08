import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { urlVisualizacion } from "../../utils/drive";
import { collection, getDocs, query, where } from "firebase/firestore";

const ESTADO_COLORES = {
  pendiente: { bg:"#fff8e1", color:"#c9a84c", texto:"⏳ Pendiente" },
  habilitado: { bg:"#e8f5ee", color:"#1a6e4a", texto:"✅ Habilitado" },
  rechazado: { bg:"#fdecea", color:"#c0392b", texto:"❌ Rechazado" },
  baja_solicitada: { bg:"#f5f0e8", color:"#8a9eaa", texto:"📋 Baja solicitada" },
  inactivo: { bg:"#f5f0e8", color:"#444", texto:"🚫 Inactivo" },
};

export default function MisJugadores({ userData, onVolver }) {
  const [jugadores, setJugadores] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarJugadores(); }, [userData]);

  async function cargarJugadores() {
    if (!userData?.clubId) return;
    setLoading(true);
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), where("clubId", "==", userData.clubId)));
    setJugadores(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    setLoading(false);
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
        <input
          style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box" }}
          placeholder="🔍 Buscar por nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div style={{ display:"flex", gap:8 }}>
          <select
            style={{ flex:1, padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="habilitado">Habilitado</option>
            <option value="rechazado">Rechazado</option>
            <option value="baja_solicitada">Baja solicitada</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select
            style={{ flex:1, padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>Cargando...</div>}

      {!loading && jugadoresFiltrados.length === 0 && (
        <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem", background:"white", borderRadius:12, border:"1px solid #ede5d5" }}>
          No hay jugadores con ese filtro.
        </div>
      )}

      {jugadoresFiltrados.map(j => {
        const estado = ESTADO_COLORES[j.estado] || ESTADO_COLORES.pendiente;
        return (
          <div key={j.id} style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", padding:"1rem", marginBottom:"0.75rem" }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              {j.fotoCarnetUrl && (
                <img src={urlVisualizacion(j.fotoCarnetUrl)} alt="carnet" style={{ width:50, height:67, objectFit:"cover", borderRadius:6, border:"1px solid #ede5d5", flexShrink:0 }} />
              )}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600, color:"#1e3a4a" }}>{j.apellido}, {j.nombre}</div>
                <div style={{ fontSize:12, color:"#8a9eaa", marginTop:2 }}>DNI: {j.dni} · Nac: {j.fechaNacimiento}</div>
                <div style={{ fontSize:12, color:"#4a6070", marginTop:2 }}>Categoría: {j.categoria || "—"}</div>
                {j.motivoRechazo && (
                  <div style={{ fontSize:12, color:"#c0392b", marginTop:6, background:"#fdecea", borderRadius:6, padding:"4px 8px" }}>
                    Motivo: {j.motivoRechazo}
                  </div>
                )}
              </div>
              <span style={{ background:estado.bg, color:estado.color, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
                {estado.texto}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
