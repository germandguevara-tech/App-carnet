import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  card: { background:"white", borderRadius:12, padding:"1.5rem", border:"1px solid #ede5d5", marginBottom:"1rem" },
  input: { width:"100%", padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" },
  label: { fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" },
};

export default function Configuracion() {
  const [rutaBase, setRutaBase] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargarConfig(); }, []);

  async function cargarConfig() {
    const snap = await getDoc(doc(db, "config_carnet", "general"));
    if (snap.exists()) {
      setRutaBase(snap.data().rutaBase || "");
    }
  }

  async function guardar() {
    setLoading(true);
    await setDoc(doc(db, "config_carnet", "general"), { rutaBase });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={s.titulo}>⚙️ Configuración</div>
      </div>

      <div style={s.card}>
        <div style={{ fontSize:15, fontWeight:600, color:"#1e3a4a", marginBottom:"1rem" }}>Ruta base para fotos (CorelDraw)</div>
        <div style={{ fontSize:13, color:"#4a6070", marginBottom:"1rem", lineHeight:1.6 }}>
          Esta es la carpeta donde descargás las fotos desde Google Drive. Se usa para generar las rutas en el Excel para la fusión de CorelDraw.
          <br /><br />
          Ejemplo: <code style={{ background:"#f5f0e8", padding:"2px 6px", borderRadius:4 }}>C:\Users\Usuario\Documents\App-Carnet</code>
        </div>
        <div style={{ marginBottom:"1rem" }}>
          <label style={s.label}>Ruta base</label>
          <input
            style={s.input}
            value={rutaBase}
            onChange={e => setRutaBase(e.target.value)}
            placeholder="C:\Users\Usuario\Documents\App-Carnet"
          />
        </div>
        <div style={{ fontSize:12, color:"#8a9eaa", marginBottom:"1rem" }}>
          El Excel va a generar rutas como:<br />
          <code style={{ background:"#f5f0e8", padding:"2px 6px", borderRadius:4, fontSize:11 }}>
            {rutaBase || "C:\\Users\\Usuario\\Documents\\App-Carnet"}\Liga Futsal Hurlingham\Prueba\RESERVA-APELLIDO NOMBRE.jpg
          </code>
        </div>
        <button style={s.btn} onClick={guardar} disabled={loading}>
          {guardado ? "✓ Guardado" : loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
