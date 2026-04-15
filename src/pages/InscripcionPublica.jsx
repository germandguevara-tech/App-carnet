import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore";
import { subirFotoADrive, generarNombreCarnet, generarNombreDniFrente, generarNombreDniDorso } from "../utils/drive";
import { useParams } from "react-router-dom";

const estilos = {
  btn: { width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer" },
  btnGris: { width:"100%", background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" },
  input: { width:"100%", padding:"12px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", background:"white", color:"#1a2e38", WebkitTextFillColor:"#1a2e38" },
  label: { fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 },
};

function parsearMRZ(texto) {
  const lineas = texto.split("\n").map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea.match(/^IDARG\d{7,8}/)) {
      const dni = linea.match(/IDARG(\d{7,8})/)?.[1] || "";
      const linea2 = lineas[i + 1] || "";
      const linea3 = lineas[i + 2] || "";
      let fechaNacimiento = "";
      const fechaMatch = linea2.match(/(\d{6})\d?[MF]/);
      if (fechaMatch) {
        const f = fechaMatch[1];
        const anio = parseInt(f.substring(0,2));
        const anioCompleto = anio > 30 ? `19${f.substring(0,2)}` : `20${f.substring(0,2)}`;
        const mes = f.substring(2,4);
        const dia = f.substring(4,6);
        const mesNum = parseInt(mes);
        const diaNum = parseInt(dia);
        if (mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
          fechaNacimiento = `${anioCompleto}-${mes}-${dia}`;
        }
      }
      let apellido = "", nombre = "";
      if (linea3.includes("<<")) {
        const partes = linea3.split("<<");
        apellido = partes[0].replace(/</g, " ").trim();
        nombre = (partes[1] || "").replace(/</g, " ").trim();
      }
      if (dni || apellido) return { dni, apellido, nombre, fechaNacimiento };
    }
  }
  return null;
}

function parsearOCR(texto) {
  if (!texto) return null;
  const lineas = texto.split("\n").map(l => l.trim()).filter(Boolean);
  let apellido = "", nombre = "", dni = "", fechaNacimiento = "";
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const siguiente = lineas[i + 1] || "";
    if (linea.match(/Apellido|Surname/i)) {
      let j = i + 1;
      while (j < lineas.length && j < i + 4) {
        const candidato = lineas[j].replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "").trim();
        if (candidato.length > 1 && !candidato.toUpperCase().includes("EXTRANJERO") && !candidato.toUpperCase().includes("DOCUMENT")) {
          apellido = candidato; break;
        }
        j++;
      }
    }
    if (linea.match(/^Nombre|^Name/i) && !linea.match(/Nacimiento|birth/i)) {
      const val = siguiente.replace(/EXTRANJERO/gi, "").replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "").trim();
      if (val.length > 1) nombre = val;
    }
    if (linea.match(/Documento|Document/i)) {
      const dniLimpio = siguiente.replace(/\./g, "").replace(/\s/g, "");
      const dniMatch = dniLimpio.match(/\d{7,8}/);
      if (dniMatch) dni = dniMatch[0];
    }
    if (linea.match(/nacimiento|birth/i)) {
      const sig = siguiente.replace(/\//g, " ").replace(/\s+/g, " ").trim();
      const formatoPuntos = sig.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (formatoPuntos) {
        fechaNacimiento = `${formatoPuntos[3]}-${formatoPuntos[2].padStart(2,"0")}-${formatoPuntos[1].padStart(2,"0")}`;
      } else {
        const meses = { ENE:"01",JAN:"01",FEB:"02",MAR:"03",ABR:"04",APR:"04",MAY:"05",JUN:"06",JUL:"07",AGO:"08",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DIC:"12",DEC:"12" };
        const p = sig.match(/(\d{1,2})\s+([A-Z]{3})\s+[A-Z]{3}\s+(\d{4})/);
        if (p) fechaNacimiento = `${p[3]}-${meses[p[2]]||"01"}-${p[1].padStart(2,"0")}`;
      }
    }
  }
  if (apellido || nombre || dni) return { apellido, nombre, dni, fechaNacimiento };
  return null;
}

function fechaValida(f) {
  if (!f) return false;
  const partes = f.split("-");
  if (partes.length !== 3) return false;
  const mes = parseInt(partes[1]);
  const dia = parseInt(partes[2]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

function combinarDatos(resultados) {
  const combined = { apellido:"", nombre:"", dni:"", fechaNacimiento:"" };
  for (const r of resultados) {
    if (!r) continue;
    if (!combined.apellido && r.apellido && !r.apellido.toLowerCase().includes("document") && !r.apellido.toUpperCase().includes("EXTRANJERO")) combined.apellido = r.apellido;
    if (!combined.nombre && r.nombre && !r.nombre.toLowerCase().includes("document") && !r.nombre.toUpperCase().includes("EXTRANJERO")) combined.nombre = r.nombre;
    if (!combined.dni && r.dni) combined.dni = r.dni;
    if (!combined.fechaNacimiento && r.fechaNacimiento && fechaValida(r.fechaNacimiento)) combined.fechaNacimiento = r.fechaNacimiento;
  }
  return combined;
}

export default function InscripcionPublica() {
  const { clubId, torneoId } = useParams();
  const [paso, setPaso] = useState(1);
  const [clubData, setClubData] = useState(null);
  const [torneoData, setTorneoData] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [datos, setDatos] = useState({ apellido:"", nombre:"", dni:"", fechaNacimiento:"", categoria:"" });
  const [fotoFrente, setFotoFrente] = useState(null);
  const [fotoDorso, setFotoDorso] = useState(null);
  const [fotoCarnet, setFotoCarnet] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [inscripcionCerrada, setInscripcionCerrada] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    try {
      const snapClub = await getDocs(query(collection(db, "clubes_carnet"), where("uid", "==", clubId)));
      if (snapClub.empty) { setInscripcionCerrada(true); setCargando(false); return; }
      const club = snapClub.docs[0].data();
      setClubData(club);

      const snapTorneo = await getDocs(query(collection(db, "torneos_carnet"), where("__name__", "==", torneoId)));
      if (snapTorneo.empty) { setInscripcionCerrada(true); setCargando(false); return; }
      const torneo = snapTorneo.docs[0].data();
      setTorneoData(torneo);

      const torneoActivo = torneo.estado === "activo";
      const clubHabilitado = club.habilitado !== false;
      if (!torneoActivo && !clubHabilitado) { setInscripcionCerrada(true); setCargando(false); return; }

      const ids = torneo.categorias || [];
      if (ids.length > 0) {
        const snapCats = await getDocs(collection(db, "categorias_carnet"));
        const todas = snapCats.docs.map(d => ({ id:d.id, ...d.data() }));
        setCategorias(todas.filter(c => ids.includes(c.id)));
      }
    } catch(e) { setInscripcionCerrada(true); }
    setCargando(false);
  }

  async function leerTextoDeImagen(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(",")[1];
          const response = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action:"leerDNI", base64, mimeType: file.type })
          });
          const data = await response.json();
          resolve(data.ok ? data.texto : null);
        } catch(e) { resolve(null); }
      };
      reader.readAsDataURL(file);
    });
  }

  async function irPaso2() {
    if (!fotoFrente || !fotoDorso) { setError("Tenés que subir las dos fotos del DNI"); return; }
    setError(""); setProcesando(true);
    try {
      const [textoFrente, textoDorso] = await Promise.all([leerTextoDeImagen(fotoFrente), leerTextoDeImagen(fotoDorso)]);
      const mrzFrente = textoFrente ? parsearMRZ(textoFrente) : null;
      const mrzDorso = textoDorso ? parsearMRZ(textoDorso) : null;
      const ocrFrente = textoFrente ? parsearOCR(textoFrente) : null;
      const ocrDorso = textoDorso ? parsearOCR(textoDorso) : null;
      const mrzPriority = mrzDorso || mrzFrente;
      const ocrPriority = ocrFrente || ocrDorso;
      const resultado = combinarDatos([mrzPriority, ocrPriority]);
      if (resultado.apellido || resultado.nombre || resultado.dni) {
        setDatos(prev => ({ ...prev, ...resultado }));
      }
    } catch(e) { console.log("Error:", e.message); }
    setProcesando(false); setPaso(2);
  }

  async function confirmarInscripcion() {
    if (!datos.apellido || !datos.nombre || !datos.dni || !datos.categoria) { setError("Completá todos los campos"); return; }
    if (!fotoCarnet) { setError("Falta la foto carnet"); return; }
    setLoading(true); setError("");
    try {
      const torneoNombre = torneoData?.nombre || "Torneo";
      const clubNombre = clubData?.nombre || "Club";
      let urlCarnet = "", urlDniFrente = "", urlDniDorso = "";
      if (fotoCarnet) { const r = await subirFotoADrive({ archivo:fotoCarnet, nombreArchivo:generarNombreCarnet(datos.apellido, datos.nombre, datos.categoria), torneoNombre, clubNombre }); urlCarnet = r.url; }
      if (fotoFrente) { const r = await subirFotoADrive({ archivo:fotoFrente, nombreArchivo:generarNombreDniFrente(datos.apellido, datos.nombre, datos.dni), torneoNombre, clubNombre }); urlDniFrente = r.url; }
      if (fotoDorso) { const r = await subirFotoADrive({ archivo:fotoDorso, nombreArchivo:generarNombreDniDorso(datos.apellido, datos.nombre, datos.dni), torneoNombre, clubNombre }); urlDniDorso = r.url; }

      const snapExistente = await getDocs(query(collection(db, "jugadores_carnet"), where("dni", "==", datos.dni), where("clubId", "==", clubId)));
      const datosJugador = { apellido:datos.apellido, nombre:datos.nombre, dni:datos.dni, fechaNacimiento:datos.fechaNacimiento, categoria:datos.categoria, clubId, torneoId, estado:"pendiente", motivoRechazo:"", fotoCarnetUrl:urlCarnet, fotoDniFrente:urlDniFrente, fotoDniDorso:urlDniDorso, creadoEn:new Date() };

      if (!snapExistente.empty) {
        const jugadorExistente = snapExistente.docs[0].data();
        if (!["rechazado","inactivo"].includes(jugadorExistente.estado)) {
          setError("Ya estás inscripto en este club");
          setLoading(false); return;
        }
        await updateDoc(doc(db, "jugadores_carnet", snapExistente.docs[0].id), datosJugador);
      } else {
        await addDoc(collection(db, "jugadores_carnet"), datosJugador);
      }
      setExito(true);
    } catch(e) { setError("Error al inscribir: " + e.message); }
    setLoading(false);
  }

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif" }}>
      <div style={{ color:"#1e3a4a", fontSize:14 }}>Cargando...</div>
    </div>
  );

  if (inscripcionCerrada) return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", padding:"2rem" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:"1rem" }}>🔒</div>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a", marginBottom:8 }}>Inscripción cerrada</div>
        <div style={{ fontSize:14, color:"#4a6070" }}>La inscripción no está disponible en este momento.</div>
      </div>
    </div>
  );

  if (exito) return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", padding:"2rem" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:72, height:72, background:"#e8d5a0", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 1rem" }}>✓</div>
        <div style={{ fontSize:20, fontWeight:600, color:"#1e3a4a", marginBottom:8 }}>¡Inscripción enviada!</div>
        <div style={{ fontSize:14, color:"#4a6070" }}>Tu inscripción fue enviada y está pendiente de revisión por el club.</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", fontFamily:"sans-serif" }}>
      <div style={{ background:"#1e3a4a", padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, background:"#e8d5a0", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚽</div>
        <div>
          <div style={{ color:"white", fontWeight:600, fontSize:15 }}>{clubData?.nombre}</div>
          <div style={{ color:"#e8d5a0", fontSize:11 }}>{torneoData?.nombre}</div>
        </div>
      </div>

      <div style={{ padding:"1.25rem", maxWidth:480, margin:"0 auto" }}>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a", marginBottom:"1.25rem" }}>Inscribirse</div>

        <div style={{ display:"flex", alignItems:"center", marginBottom:"1.5rem" }}>
          {[1,2,3].map((n, i) => (
            <div key={n} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : 0 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background: paso>n ? "#c9a84c" : paso===n ? "#1e3a4a" : "#ede5d5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color: paso>=n ? "white" : "#8a9eaa", flexShrink:0 }}>
                {paso>n ? "✓" : n}
              </div>
              {i < 2 && <div style={{ flex:1, height:2, background: paso>n ? "#c9a84c" : "#ede5d5" }} />}
            </div>
          ))}
        </div>

        {paso === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
              📌 Subí las dos fotos de tu DNI. El sistema leerá los datos automáticamente.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={estilos.label}>Frente del DNI</label>
                <label style={{ display:"block", background: fotoFrente ? "#e8f5ee" : "white", border:`2px dashed ${fotoFrente ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, padding:"1.5rem 1rem", textAlign:"center", cursor:"pointer" }}>
                  <div style={{ fontSize:28 }}>{fotoFrente ? "✓" : "📄"}</div>
                  <div style={{ fontSize:12, color: fotoFrente ? "#1a6e4a" : "#8a9eaa", marginTop:4 }}>{fotoFrente ? "Foto cargada" : "Tocar para subir"}</div>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { if(e.target.files[0]) setFotoFrente(e.target.files[0]); }} style={{ display:"none" }} />
                </label>
              </div>
              <div>
                <label style={estilos.label}>Dorso del DNI</label>
                <label style={{ display:"block", background: fotoDorso ? "#e8f5ee" : "white", border:`2px dashed ${fotoDorso ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, padding:"1.5rem 1rem", textAlign:"center", cursor:"pointer" }}>
                  <div style={{ fontSize:28 }}>{fotoDorso ? "✓" : "🔄"}</div>
                  <div style={{ fontSize:12, color: fotoDorso ? "#1a6e4a" : "#8a9eaa", marginTop:4 }}>{fotoDorso ? "Foto cargada" : "Tocar para subir"}</div>
                  <input type="file" accept="image/*" capture="environment" onChange={e => { if(e.target.files[0]) setFotoDorso(e.target.files[0]); }} style={{ display:"none" }} />
                </label>
              </div>
            </div>
            {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
            <button style={{ ...estilos.btn, opacity: procesando ? 0.7 : 1 }} onClick={irPaso2} disabled={procesando}>
              {procesando ? "Leyendo datos..." : "Siguiente →"}
            </button>
          </div>
        )}

        {paso === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Tus datos</div>
            <div><label style={estilos.label}>Apellido/s</label><input style={estilos.input} value={datos.apellido} onChange={e => setDatos({...datos, apellido:e.target.value})} placeholder="Apellido/s" /></div>
            <div><label style={estilos.label}>Nombre/s</label><input style={estilos.input} value={datos.nombre} onChange={e => setDatos({...datos, nombre:e.target.value})} placeholder="Nombre/s" /></div>
            <div><label style={estilos.label}>DNI</label><input style={estilos.input} value={datos.dni} onChange={e => setDatos({...datos, dni:e.target.value})} placeholder="Número de documento" /></div>
            <div><label style={estilos.label}>Fecha de nacimiento</label><input type="date" style={estilos.input} value={datos.fechaNacimiento} onChange={e => setDatos({...datos, fechaNacimiento:e.target.value})} /></div>
            <div>
              <label style={estilos.label}>Categoría</label>
              <select style={{ ...estilos.input, color:"#1a2e38", WebkitTextFillColor:"#1a2e38" }} value={datos.categoria} onChange={e => setDatos({...datos, categoria:e.target.value})}>
                <option value="">— Seleccioná la categoría —</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
            <button style={estilos.btn} onClick={() => { if(!datos.apellido||!datos.nombre||!datos.dni||!datos.categoria){setError("Completá todos los campos");return;} setError(""); setPaso(3); }}>Siguiente →</button>
            <button style={estilos.btnGris} onClick={() => setPaso(1)}>← Volver</button>
          </div>
        )}

        {paso === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Foto carnet</div>
            <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
              📸 Sacate una foto de frente, cara y hombros, fondo claro.
            </div>
            <div style={{ display:"flex", justifyContent:"center" }}>
              <label style={{ display:"flex", background: fotoCarnet ? "#e8f5ee" : "#1a1a2e", border:`2px solid ${fotoCarnet ? "#1a6e4a" : "rgba(201,168,76,0.4)"}`, borderRadius:10, width:180, height:240, flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", position:"relative", overflow:"hidden" }}>
                {fotoCarnet ? (
                  <img src={URL.createObjectURL(fotoCarnet)} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                ) : (
                  <>
                    <div style={{ width:100, height:133, border:"2.5px solid #c9a84c", borderRadius:4, opacity:0.8 }} />
                    <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, position:"absolute", bottom:10 }}>Tocá para sacar foto</div>
                  </>
                )}
                <input type="file" accept="image/*" capture="user" onChange={e => { if(e.target.files[0]) setFotoCarnet(e.target.files[0]); }} style={{ display:"none" }} />
              </label>
            </div>
            {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
            <button style={{ ...estilos.btn, opacity: loading ? 0.7 : 1 }} onClick={confirmarInscripcion} disabled={loading}>{loading ? "Inscribiendo..." : "Confirmar inscripción"}</button>
            <button style={estilos.btnGris} onClick={() => setPaso(2)}>← Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}