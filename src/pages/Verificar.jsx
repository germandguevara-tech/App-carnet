import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { urlVisualizacion } from "../utils/drive";

export default function Verificar() {
  const { id } = useParams();
  const [jugador, setJugador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { cargarJugador(); }, [id]);

  async function cargarJugador() {
    try {
      const snap = await getDoc(doc(db, "jugadores_carnet", id));
      if (snap.exists()) {
        setJugador({ id: snap.id, ...snap.data() });
      } else {
        setError("Jugador no encontrado");
      }
    } catch(e) {
      setError("Error al cargar el carnet");
    }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#1e3a4a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"white", fontSize:14 }}>Verificando carnet...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", background:"#1e3a4a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ color:"white", fontSize:16, fontWeight:600 }}>Carnet no válido</div>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:13 }}>{error}</div>
    </div>
  );

  const habilitado = jugador.estado === "habilitado";

  return (
    <div style={{ minHeight:"100vh", background:"#1e3a4a", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", fontFamily:"sans-serif" }}>
      <div style={{ width:"100%", maxWidth:340 }}>

        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ color:"#e8d5a0", fontSize:13, fontWeight:600, textTransform:"uppercase", letterSpacing:"1px" }}>App-Carnet</div>
          <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, marginTop:4 }}>Verificación de carnet</div>
        </div>

        <div style={{ background:"white", borderRadius:20, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}>
          <div style={{ background:"#1e3a4a", padding:"1.25rem", display:"flex", justifyContent:"center" }}>
            <div style={{ width:140, height:187, borderRadius:10, overflow:"hidden", border:"3px solid rgba(255,255,255,0.15)", background:"#2e5266", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {jugador.fotoCarnetUrl ? (
                <img src={urlVisualizacion(jugador.fotoCarnetUrl)} alt="foto" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <span style={{ fontSize:48, opacity:0.3 }}>👤</span>
              )}
            </div>
          </div>

          <div style={{ background:"#1e3a4a", padding:"0.5rem 1.25rem 1.25rem", display:"flex", justifyContent:"center" }}>
            <div style={{ background:"#c9a84c", color:"#1e3a4a", borderRadius:6, padding:"4px 14px", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px" }}>
              {jugador.categoria}
            </div>
          </div>

          <div style={{ padding:"1.25rem" }}>
            <div style={{ fontSize:18, fontWeight:700, color:"#1e3a4a", marginBottom:12, lineHeight:1.3 }}>
              {jugador.apellido?.toUpperCase()}, {jugador.nombre?.toUpperCase()}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{ fontSize:12, color:"#8a9eaa", width:90 }}>Documento</span>
                <span style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>{jugador.dni}</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{ fontSize:12, color:"#8a9eaa", width:90 }}>Nacimiento</span>
                <span style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>
                  {jugador.fechaNacimiento ? jugador.fechaNacimiento.split("-").reverse().join("/") : "—"}
                </span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{ fontSize:12, color:"#8a9eaa", width:90 }}>Categoría</span>
                <span style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>{jugador.categoria}</span>
              </div>
            </div>
          </div>

          <div style={{ padding:"1rem 1.25rem", background: habilitado ? "#e8f5ee" : "#fdecea", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            <div style={{ width:12, height:12, borderRadius:"50%", background: habilitado ? "#1a6e4a" : "#c0392b" }} />
            <span style={{ fontSize:15, fontWeight:700, color: habilitado ? "#1a6e4a" : "#c0392b", textTransform:"uppercase", letterSpacing:"1px" }}>
              {habilitado ? "HABILITADO" : "NO HABILITADO"}
            </span>
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:"1rem", color:"rgba(255,255,255,0.3)", fontSize:11 }}>
          Verificado el {new Date().toLocaleDateString("es-AR")} a las {new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" })}
        </div>
      </div>
    </div>
  );
}
