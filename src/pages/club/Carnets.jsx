import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { urlVisualizacion } from "../../utils/drive";
import { QRCodeSVG } from "qrcode.react";

export default function Carnets({ userData, onVolver }) {
  const [jugadores, setJugadores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarJugadores(); }, [userData]);

  async function cargarJugadores() {
    if (!userData?.clubId) return;
    setLoading(true);
    const snap = await getDocs(query(
      collection(db, "jugadores_carnet"),
      where("clubId", "==", userData.clubId),
      where("estado", "==", "habilitado")
    ));
    const lista = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    setJugadores(lista);
    const cats = [...new Set(lista.map(j => j.categoria).filter(Boolean))].sort();
    setCategorias(cats);
    if (cats.length > 0) setCategoriaFiltro(cats[0]);
    setLoading(false);
  }

  const jugadoresFiltrados = categoriaFiltro
    ? jugadores.filter(j => j.categoria === categoriaFiltro)
    : jugadores;

  return (
    <div style={{ minHeight:"100vh", background:"#1e3a4a", fontFamily:"sans-serif" }}>

      <div style={{ padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onVolver} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:20, cursor:"pointer" }}>←</button>
        <div style={{ color:"white", fontWeight:600, fontSize:16 }}>Carnets digitales</div>
      </div>

      <div style={{ padding:"0 1.25rem 1rem", overflowX:"auto", display:"flex", gap:8, scrollbarWidth:"none" }}>
        {categorias.map(cat => (
          <button key={cat} onClick={() => setCategoriaFiltro(cat)} style={{
            background: categoriaFiltro === cat ? "#c9a84c" : "rgba(255,255,255,0.1)",
            color: categoriaFiltro === cat ? "#1e3a4a" : "rgba(255,255,255,0.7)",
            border: "none", borderRadius:20, padding:"7px 18px", fontSize:13,
            fontWeight: categoriaFiltro === cat ? 700 : 400,
            cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s"
          }}>
            {cat}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.5)", padding:"3rem" }}>Cargando...</div>
      )}

      {!loading && jugadoresFiltrados.length === 0 && (
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.4)", padding:"3rem", fontSize:14 }}>
          No hay jugadores habilitados en esta categoría.
        </div>
      )}

      <div style={{
        display:"flex", gap:16, padding:"0.5rem 1.25rem 2rem",
        overflowX:"auto", scrollSnapType:"x mandatory",
        scrollbarWidth:"none", WebkitOverflowScrolling:"touch"
      }}>
        {jugadoresFiltrados.map(j => (
          <div key={j.id} style={{
            scrollSnapAlign:"center", flexShrink:0,
            width: "calc(100vw - 2.5rem)", maxWidth:320,
          }}>
            <CarnetCard jugador={j} />
          </div>
        ))}
      </div>

      {jugadoresFiltrados.length > 0 && (
        <div style={{ textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:12, paddingBottom:"1rem" }}>
          {jugadoresFiltrados.length} jugador{jugadoresFiltrados.length !== 1 ? "es" : ""} · deslizá para ver más
        </div>
      )}
    </div>
  );
}

function CarnetCard({ jugador }) {
  return (
    <div style={{
      background:"white", borderRadius:20, overflow:"hidden",
      boxShadow:"0 8px 32px rgba(0,0,0,0.3)"
    }}>
      <div style={{ background:"#1e3a4a", padding:"1.25rem 1.25rem 0", display:"flex", justifyContent:"center" }}>
        <div style={{
          width:140, height:187, borderRadius:10, overflow:"hidden",
          border:"3px solid rgba(255,255,255,0.15)", background:"#2e5266",
          display:"flex", alignItems:"center", justifyContent:"center"
        }}>
          {jugador.fotoCarnetUrl ? (
            <img
              src={urlVisualizacion(jugador.fotoCarnetUrl)}
              alt="foto"
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
            />
          ) : (
            <span style={{ fontSize:48, opacity:0.3 }}>👤</span>
          )}
        </div>
      </div>

      <div style={{ background:"#1e3a4a", padding:"0.75rem 1.25rem 1.25rem" }}>
        <div style={{
          display:"inline-block", background:"#c9a84c", color:"#1e3a4a",
          borderRadius:6, padding:"4px 14px", fontSize:12, fontWeight:700,
          textTransform:"uppercase", letterSpacing:"1px"
        }}>
          {jugador.categoria}
        </div>
      </div>

      <div style={{ padding:"1.25rem" }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#1e3a4a", marginBottom:8, lineHeight:1.3, wordBreak:"break-word" }}>
          {jugador.apellido?.toUpperCase()}, {jugador.nombre?.toUpperCase()}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"#8a9eaa", width:80 }}>Documento</span>
            <span style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>{jugador.dni}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"#8a9eaa", width:80 }}>Nacimiento</span>
            <span style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>{jugador.fechaNacimiento}</span>
          </div>
        </div>
      </div>

      <div style={{ background:"#f5f0e8", padding:"0.75rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#1a6e4a" }} />
          <span style={{ fontSize:11, color:"#1a6e4a", fontWeight:600 }}>HABILITADO</span>
        </div>
        <QRCodeSVG
          value={`${window.location.origin}/verificar/${jugador.id}`}
          size={56}
          bgColor="#f5f0e8"
          fgColor="#1e3a4a"
          level="M"
        />
      </div>
    </div>
  );
}
