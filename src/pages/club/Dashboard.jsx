import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import Inscripcion from "./Inscripcion";
import MisJugadores from "./MisJugadores";
import Carnets from "./Carnets";
import Verificador from "./Verificador";

export default function ClubDashboard() {
  const [tab, setTab] = useState("inicio");
  const [jugadorAReinscribir, setJugadorAReinscribir] = useState(null);
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total:0, pendientes:0, habilitados:0, rechazados:0 });
  const [clubData, setClubData] = useState(null);

  useEffect(() => { cargarDatos(); }, [userData]);

  async function cargarDatos() {
    if (!userData?.clubId) return;
    const snapClub = await getDocs(query(collection(db, "clubes_carnet"), where("uid", "==", userData.clubId)));
    if (!snapClub.empty) setClubData(snapClub.docs[0].data());
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), where("clubId", "==", userData.clubId)));
    const jugadores = snap.docs.map(d => d.data());
    setStats({
      total: jugadores.length,
      pendientes: jugadores.filter(j => j.estado === "pendiente").length,
      habilitados: jugadores.filter(j => j.estado === "habilitado").length,
      rechazados: jugadores.filter(j => j.estado === "rechazado").length,
    });
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  function handleReinscribir(jugador) {
    setJugadorAReinscribir(jugador);
    setTab("inscripcion");
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", fontFamily:"sans-serif", paddingBottom:80 }}>

      {tab !== "carnets" && (
        <div style={{ background:"#1e3a4a", padding:"1rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, background:"#e8d5a0", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚽</div>
            <div>
              <div style={{ color:"white", fontWeight:600, fontSize:15 }}>{clubData?.nombre || "Mi Club"}</div>
              <div style={{ color:"#e8d5a0", fontSize:11 }}>App-Carnet</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13 }}>Salir</button>
        </div>
      )}

      <div style={{ padding: tab === "carnets" ? 0 : "1.25rem" }}>
        {tab === "inicio" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:"1.25rem" }}>
              {[
                { label:"Total inscriptos", valor:stats.total, color:"#1e3a4a" },
                { label:"Habilitados", valor:stats.habilitados, color:"#1a6e4a" },
                { label:"Pendientes", valor:stats.pendientes, color:"#c9a84c" },
                { label:"Rechazados", valor:stats.rechazados, color:"#c0392b" },
              ].map(s => (
                <div key={s.label} style={{ background:"white", borderRadius:12, padding:"1rem", border:"1px solid #ede5d5" }}>
                  <div style={{ fontSize:28, fontWeight:600, color:s.color }}>{s.valor}</div>
                  <div style={{ fontSize:12, color:"#8a9eaa" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setJugadorAReinscribir(null); setTab("inscripcion"); }} style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:14, padding:"16px", fontSize:16, fontWeight:600, cursor:"pointer", marginBottom:"1rem", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:20 }}>+</span> Inscribir jugador
            </button>
            <button onClick={() => setTab("jugadores")} style={{ width:"100%", background:"white", color:"#1e3a4a", border:"1.5px solid #1e3a4a", borderRadius:14, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer", marginBottom:"1rem", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              👥 Ver mis jugadores
            </button>
            <button onClick={() => setTab("carnets")} style={{ width:"100%", background:"#c9a84c", color:"white", border:"none", borderRadius:14, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              🪪 Carnets digitales
            </button>
          </div>
        )}

        {tab === "inscripcion" && (
          <Inscripcion
            clubData={clubData}
            userData={userData}
            jugadorAReinscribir={jugadorAReinscribir}
            onVolver={() => { setTab("inicio"); setJugadorAReinscribir(null); cargarDatos(); }}
          />
        )}

        {tab === "jugadores" && (
          <MisJugadores
            clubData={clubData}
            userData={userData}
            onVolver={() => setTab("inicio")}
            onReinscribir={handleReinscribir}
          />
        )}

        {tab === "carnets" && (
          <Carnets userData={userData} onVolver={() => setTab("inicio")} />
        )}

        {tab === "verificar" && (
          <Verificador onVolver={() => setTab("inicio")} />
        )}
      </div>

      {tab !== "carnets" && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"1px solid #ede5d5", display:"flex", padding:"8px 0 12px" }}>
          {[
            { id:"inicio", icon:"🏠", label:"Inicio" },
            { id:"inscripcion", icon:"➕", label:"Inscribir" },
            { id:"jugadores", icon:"👥", label:"Jugadores" },
            { id:"carnets", icon:"🪪", label:"Carnets" },
            { id:"verificar", icon:"🔍", label:"Verificar" },
          ].map(item => (
            <button key={item.id} onClick={() => { if(item.id === "inscripcion") setJugadorAReinscribir(null); setTab(item.id); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <span style={{ fontSize:20, opacity: tab === item.id ? 1 : 0.4 }}>{item.icon}</span>
              <span style={{ fontSize:10, color: tab === item.id ? "#1e3a4a" : "#8a9eaa", fontWeight: tab === item.id ? 600 : 400 }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
