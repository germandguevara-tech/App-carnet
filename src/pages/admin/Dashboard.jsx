import { useState } from "react";
import { auth } from "../../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Torneos from "./Torneos";
import Clubes from "./Clubes";
import Categorias from "./Categorias";
import Inscriptos from "./Inscriptos";

const MENU = [
  { id: "torneos", label: "Torneos", icon: "🏆" },
  { id: "clubes", label: "Clubes", icon: "🏟️" },
  { id: "categorias", label: "Categorías", icon: "📋" },
  { id: "inscriptos", label: "Inscriptos", icon: "👥" },
];

export default function AdminDashboard() {
  const [seccion, setSeccion] = useState("torneos");
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"sans-serif", background:"#f5f0e8" }}>

      <div style={{ width:220, background:"#1e3a4a", display:"flex", flexDirection:"column", position:"fixed", top:0, bottom:0 }}>
        <div style={{ padding:"1.5rem 1rem", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, background:"#e8d5a0", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⚽</div>
            <div>
              <div style={{ color:"white", fontWeight:600, fontSize:14 }}>App-Carnet</div>
              <div style={{ color:"#e8d5a0", fontSize:11 }}>Panel Admin</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:"1rem 0" }}>
          {MENU.map(item => (
            <button key={item.id} onClick={() => setSeccion(item.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:12,
              padding:"12px 1.25rem", background: seccion === item.id ? "rgba(255,255,255,0.1)" : "transparent",
              border:"none", cursor:"pointer", color: seccion === item.id ? "white" : "rgba(255,255,255,0.6)",
              fontSize:14, fontWeight: seccion === item.id ? 600 : 400,
              borderLeft: seccion === item.id ? "3px solid #c9a84c" : "3px solid transparent",
              transition:"all 0.15s"
            }}>
              <span style={{ fontSize:18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding:"1rem", borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={handleLogout} style={{
            width:"100%", padding:"10px", background:"rgba(255,255,255,0.1)",
            border:"none", borderRadius:8, color:"rgba(255,255,255,0.7)",
            cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:8, justifyContent:"center"
          }}>
            ⎋ Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ marginLeft:220, flex:1, padding:"2rem" }}>
        {seccion === "torneos" && <Torneos />}
        {seccion === "clubes" && <Clubes />}
        {seccion === "categorias" && <Categorias />}
        {seccion === "inscriptos" && <Inscriptos />}
      </div>
    </div>
  );
}
