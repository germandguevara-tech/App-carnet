import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("UID:", cred.user.uid);
      const q = query(collection(db, "Usuarios"), where("uid", "==", cred.user.uid));
      const snapU = await getDocs(q);
      console.log("Encontrado:", !snapU.empty);
      if (!snapU.empty) {
        const data = snapU.docs[0].data();
        const rol = (data.Rol || data.rol || "").toLowerCase();
        console.log("Rol:", rol);
        if (rol === "admin") navigate("/admin");
        else if (rol === "club") navigate("/club");
        else if (rol === "arbitro") navigate("/arbitro");
      } else {
        setError("Usuario no encontrado en el sistema");
      }
    } catch (err) {
      console.log("Error:", err.message);
      setError("Usuario o contraseña incorrectos");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif" }}>
      <div style={{ background:"white", borderRadius:20, overflow:"hidden", width:"100%", maxWidth:380, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ background:"#1e3a4a", padding:"2.5rem 2rem", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <div style={{ width:72, height:72, background:"#e8d5a0", borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>⚽</div>
          <div style={{ color:"white", fontSize:22, fontWeight:600 }}>App-Carnet</div>
          <div style={{ color:"#e8d5a0", fontSize:13 }}>Sistema de inscripción de jugadores</div>
        </div>
        <form onSubmit={handleLogin} style={{ padding:"2rem" }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width:"100%", padding:"12px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:15, outline:"none", boxSizing:"border-box" }} required />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width:"100%", padding:"12px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:15, outline:"none", boxSizing:"border-box" }} required />
          </div>
          {error && <div style={{ color:"#c0392b", fontSize:13, marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:14, fontSize:15, fontWeight:600, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1 }}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
