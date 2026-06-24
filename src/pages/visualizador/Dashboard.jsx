import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
import { urlVisualizacion } from "../../utils/drive";
import CarnetViz from "./CarnetViz";

const ESTADO_INFO = {
  pendiente:       { bg:"#fff8e1", color:"#c9a84c", texto:"⏳ Pendiente" },
  habilitado:      { bg:"#e8f5ee", color:"#1a6e4a", texto:"✅ Habilitado" },
  rechazado:       { bg:"#fdecea", color:"#c0392b", texto:"❌ Rechazado" },
  baja_solicitada: { bg:"#f5f0e8", color:"#8a9eaa", texto:"📋 Baja solicitada" },
  inactivo:        { bg:"#f5f0e8", color:"#444",    texto:"🚫 Inactivo" },
};

export default function VisualizadorDashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("jugadores");
  const [torneoNombre, setTorneoNombre] = useState("");
  const [jugadores, setJugadores] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroClub, setFiltroClub] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [jugadorModal, setJugadorModal] = useState(null);

  useEffect(() => { if (userData?.torneoId) cargarDatos(); }, [userData]);

  async function cargarDatos() {
    setLoading(true);

    const torneoSnap = await getDoc(doc(db, "torneos_carnet", userData.torneoId));
    if (torneoSnap.exists()) setTorneoNombre(torneoSnap.data().nombre);

    const snapClubes = await getDocs(query(collection(db, "clubes_carnet"), where("torneoId", "==", userData.torneoId)));
    setClubes(snapClubes.docs.map(d => ({ id:d.id, ...d.data() })));

    const estadosVisibles = userData.estadosVisibles || [];
    if (estadosVisibles.length > 0) {
      const snap = await getDocs(query(
        collection(db, "jugadores_carnet"),
        where("torneoId", "==", userData.torneoId),
        where("estado", "in", estadosVisibles)
      ));
      setJugadores(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } else {
      setJugadores([]);
    }
    setLoading(false);
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  function getNombreClub(clubId) {
    return clubes.find(c => c.uid === clubId)?.nombre || "—";
  }

  const categorias = [...new Set(jugadores.map(j => j.categoria).filter(Boolean))].sort();
  const estadosEnJugadores = [...new Set(jugadores.map(j => j.estado).filter(Boolean))];

  const jugadoresFiltrados = jugadores.filter(j => {
    const matchClub   = filtroClub      ? j.clubId    === filtroClub      : true;
    const matchCat    = filtroCategoria ? j.categoria === filtroCategoria  : true;
    const matchEstado = filtroEstado    ? j.estado    === filtroEstado     : true;
    const matchBusq   = busqueda
      ? `${j.apellido} ${j.nombre} ${j.dni}`.toLowerCase().includes(busqueda.toLowerCase())
      : true;
    return matchClub && matchCat && matchEstado && matchBusq;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", fontFamily:"sans-serif", paddingBottom: tab === "carnets" ? 0 : 80 }}>

      {tab !== "carnets" && (
        <div style={{ background:"#1e3a4a", padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ color:"white", fontWeight:600, fontSize:15 }}>{torneoNombre || "Visualizador"}</div>
            <div style={{ color:"#e8d5a0", fontSize:11 }}>Solo lectura</div>
          </div>
          <button onClick={handleLogout} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13 }}>
            Salir
          </button>
        </div>
      )}

      {tab === "jugadores" && (
        <div style={{ padding:"1.25rem" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1rem" }}>
            <input
              style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", background:"white" }}
              placeholder="🔍 Buscar por nombre o DNI..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:8 }}>
              <select
                style={{ padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
                value={filtroClub}
                onChange={e => setFiltroClub(e.target.value)}
              >
                <option value="">Todos los clubes</option>
                {clubes.map(c => <option key={c.uid} value={c.uid}>{c.nombre}</option>)}
              </select>
              <select
                style={{ padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                style={{ padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white", gridColumn: isMobile ? "span 2" : "auto" }}
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {estadosEnJugadores.map(e => (
                  <option key={e} value={e}>{ESTADO_INFO[e]?.texto?.replace(/^[^\s]+\s/, "") || e}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize:12, color:"#8a9eaa", marginBottom:"0.75rem" }}>
            {jugadoresFiltrados.length} jugador{jugadoresFiltrados.length !== 1 ? "es" : ""}
          </div>

          {loading && (
            <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>Cargando...</div>
          )}

          {!loading && jugadoresFiltrados.length === 0 && (
            <div style={{ textAlign:"center", color:"#8a9eaa", padding:"2rem", background:"white", borderRadius:12, border:"1px solid #ede5d5" }}>
              No hay jugadores con ese filtro.
            </div>
          )}

          {!loading && jugadoresFiltrados.map(j => {
            const estado = ESTADO_INFO[j.estado] || {};
            return (
              <div
                key={j.id}
                onClick={() => setJugadorModal(j)}
                style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", padding:"0.875rem", marginBottom:"0.625rem", cursor:"pointer", display:"flex", gap:12, alignItems:"center", transition:"box-shadow 0.15s" }}
              >
                <div style={{ width:44, height:58, borderRadius:6, overflow:"hidden", background:"#f5f0e8", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #ede5d5" }}>
                  {j.fotoCarnetUrl
                    ? <img src={urlVisualizacion(j.fotoCarnetUrl)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <span style={{ fontSize:20 }}>👤</span>
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textTransform:"uppercase" }}>
                    {j.apellido}, {j.nombre}
                  </div>
                  <div style={{ fontSize:12, color:"#8a9eaa", marginTop:2 }}>DNI {j.dni} · {j.categoria}</div>
                  <div style={{ fontSize:12, color:"#4a6070", marginTop:1 }}>{getNombreClub(j.clubId)}</div>
                </div>
                <span style={{ background:estado.bg, color:estado.color, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:600, whiteSpace:"nowrap", flexShrink:0 }}>
                  {estado.texto}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "carnets" && (
        <CarnetViz
          userData={userData}
          torneoNombre={torneoNombre}
          onVolver={() => setTab("jugadores")}
        />
      )}

      {tab !== "carnets" && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #ede5d5", display:"flex", padding:"8px 0 12px" }}>
          {[
            { id:"jugadores", icon:"👥", label:"Jugadores" },
            ...(userData?.verCarnets ? [{ id:"carnets", icon:"🪪", label:"Carnets" }] : []),
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <span style={{ fontSize:20, opacity: tab === item.id ? 1 : 0.4 }}>{item.icon}</span>
              <span style={{ fontSize:10, color: tab === item.id ? "#1e3a4a" : "#8a9eaa", fontWeight: tab === item.id ? 600 : 400 }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {jugadorModal && (
        <ModalJugador
          jugador={jugadorModal}
          clubNombre={getNombreClub(jugadorModal.clubId)}
          onClose={() => setJugadorModal(null)}
        />
      )}
    </div>
  );
}

function ModalJugador({ jugador, clubNombre, onClose }) {
  const estado = ESTADO_INFO[jugador.estado] || {};
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"white", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ position:"sticky", top:0, background:"white", padding:"1rem 1.25rem", borderBottom:"1px solid #ede5d5", display:"flex", alignItems:"center", justifyContent:"space-between", borderRadius:"20px 20px 0 0" }}>
          <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a", textTransform:"uppercase" }}>
            {jugador.apellido}, {jugador.nombre}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8a9eaa", lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:"1.25rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ display:"flex", justifyContent:"center" }}>
            <div style={{ width:100, height:133, borderRadius:10, overflow:"hidden", background:"#f5f0e8", border:"1px solid #ede5d5", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {jugador.fotoCarnetUrl
                ? <img src={urlVisualizacion(jugador.fotoCarnetUrl, 300)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ fontSize:36 }}>👤</span>
              }
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"center" }}>
            <span style={{ background:estado.bg, color:estado.color, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:600 }}>
              {estado.texto}
            </span>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"DNI", valor:jugador.dni },
              { label:"Fecha de nacimiento", valor:jugador.fechaNacimiento ? jugador.fechaNacimiento.split("-").reverse().join("/") : "—" },
              { label:"Categoría", valor:jugador.categoria },
              { label:"Club", valor:clubNombre },
            ].map(({ label, valor }) => (
              <div key={label} style={{ background:"#f5f0e8", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:10, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:13, fontWeight:600, color:"#1e3a4a" }}>{valor || "—"}</div>
              </div>
            ))}
          </div>

          {(jugador.fotoDniFrente || jugador.fotoDniDorso) && (
            <div>
              <div style={{ fontSize:11, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Fotos DNI</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {jugador.fotoDniFrente && (
                  <div>
                    <div style={{ fontSize:11, color:"#4a6070", marginBottom:4 }}>Frente</div>
                    <img src={urlVisualizacion(jugador.fotoDniFrente, 400)} alt="DNI frente" style={{ width:"100%", aspectRatio:"85.6/54", objectFit:"cover", borderRadius:8, border:"1px solid #ede5d5", display:"block" }} />
                  </div>
                )}
                {jugador.fotoDniDorso && (
                  <div>
                    <div style={{ fontSize:11, color:"#4a6070", marginBottom:4 }}>Dorso</div>
                    <img src={urlVisualizacion(jugador.fotoDniDorso, 400)} alt="DNI dorso" style={{ width:"100%", aspectRatio:"85.6/54", objectFit:"cover", borderRadius:8, border:"1px solid #ede5d5", display:"block" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {jugador.motivoRechazo && (
            <div style={{ background:"#fdecea", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#c0392b", fontWeight:600, textTransform:"uppercase", marginBottom:4 }}>Motivo de rechazo</div>
              <div style={{ fontSize:13, color:"#c0392b" }}>{jugador.motivoRechazo}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
