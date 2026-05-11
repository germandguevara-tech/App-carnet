import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc } from "firebase/firestore";
import { subirFotoADrive, generarNombreCarnet, generarNombreDniFrente, generarNombreDniDorso } from "../utils/drive";
import { useParams } from "react-router-dom";
import ImageCropper from "../components/ImageCropper";

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
  const [fotoFrente, setFotoFrente] = useState(null);   // dataURL string
  const [fotoDorso, setFotoDorso] = useState(null);     // dataURL string
  const [fotoCarnet, setFotoCarnet] = useState(null);   // dataURL string
  const [procesando, setProcesando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [inscripcionCerrada, setInscripcionCerrada] = useState(false);
  const [cropperSrc, setCropperSrc] = useState(null);
  const [cropperTarget, setCropperTarget] = useState(null); // "frente" | "dorso" | "carnet"
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(() => !localStorage.getItem("instrucciones_vistas"));
  const [noMostrarDenuevo, setNoMostrarDenuevo] = useState(false);

  function cerrarModalInstrucciones() {
    if (noMostrarDenuevo) localStorage.setItem("instrucciones_vistas", "1");
    setMostrarInstrucciones(false);
  }

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    try {
      const [torneoSnap, snapClub] = await Promise.all([
        getDoc(doc(db, "torneos_carnet", torneoId)),
        getDocs(query(collection(db, "clubes_carnet"), where("uid", "==", clubId))),
      ]);

      if (!torneoSnap.exists() || snapClub.empty) { setInscripcionCerrada(true); setCargando(false); return; }

      const torneo = torneoSnap.data();
      const club = snapClub.docs[0].data();

      const permitida = torneo.estado === "activo" || club.inscripcionEspecial === true;
      if (!permitida) { setInscripcionCerrada(true); setCargando(false); return; }

      setTorneoData(torneo);
      setClubData(club);

      const catItems = torneo.categorias || [];
      if (catItems.length > 0) {
        const ids = catItems.map(c => typeof c === "string" ? c : c.id);
        const snapCats = await getDocs(collection(db, "categorias_carnet"));
        const todas = snapCats.docs.map(d => ({ id:d.id, ...d.data() }));
        setCategorias(todas.filter(c => ids.includes(c.id)));
      }
    } catch(e) { setInscripcionCerrada(true); }
    setCargando(false);
  }

  // Accepts a dataURL string (from ImageCropper) or a File object.
  async function leerTextoDeImagen(fileOrDataURL) {
    if (typeof fileOrDataURL === "string") {
      try {
        const [header, base64] = fileOrDataURL.split(",");
        const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
        const response = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ action:"leerDNI", base64, mimeType })
        });
        const data = await response.json();
        return data.ok ? data.texto : null;
      } catch(e) { return null; }
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(",")[1];
          const response = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action:"leerDNI", base64, mimeType: fileOrDataURL.type })
          });
          const data = await response.json();
          resolve(data.ok ? data.texto : null);
        } catch(e) { resolve(null); }
      };
      reader.readAsDataURL(fileOrDataURL);
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

      setProgreso("Subiendo foto carnet...");
      if (fotoCarnet) { const r = await subirFotoADrive({ archivo:fotoCarnet, nombreArchivo:generarNombreCarnet(datos.apellido, datos.nombre, datos.categoria, datos.dni), torneoNombre, clubNombre }); urlCarnet = r.url; }

      setProgreso("Subiendo foto DNI frente...");
      if (fotoFrente) { const r = await subirFotoADrive({ archivo:fotoFrente, nombreArchivo:generarNombreDniFrente(datos.apellido, datos.nombre, datos.dni), torneoNombre, clubNombre }); urlDniFrente = r.url; }

      setProgreso("Subiendo foto DNI dorso...");
      if (fotoDorso) { const r = await subirFotoADrive({ archivo:fotoDorso, nombreArchivo:generarNombreDniDorso(datos.apellido, datos.nombre, datos.dni), torneoNombre, clubNombre }); urlDniDorso = r.url; }

      setProgreso("Guardando inscripción...");
      const snapExistente = await getDocs(query(collection(db, "jugadores_carnet"), where("dni", "==", datos.dni), where("clubId", "==", clubId)));
      const datosJugador = { apellido:datos.apellido, nombre:datos.nombre, dni:datos.dni, fechaNacimiento:datos.fechaNacimiento, categoria:datos.categoria, clubId, torneoId, estado:"pendiente", motivoRechazo:"", fotoCarnetUrl:urlCarnet, fotoDniFrente:urlDniFrente, fotoDniDorso:urlDniDorso, creadoEn:new Date() };

      const catNueva = categorias.find(c => c.nombre === datos.categoria);
      const tipoNuevo = catNueva?.tipo || "jugador";

      if (!snapExistente.empty) {
        const conflicto = tipoNuevo === "jugador" && snapExistente.docs.some(d => {
          const j = d.data();
          if (["rechazado", "inactivo"].includes(j.estado)) return false;
          const catExistente = categorias.find(c => c.nombre === j.categoria);
          return (catExistente?.tipo || "jugador") === "jugador";
        });

        if (conflicto) {
          setError("Ya estás inscripto en este club");
          setLoading(false);
          return;
        }

        const docReinscribir = snapExistente.docs.find(d => {
          const j = d.data();
          return j.categoria === datos.categoria && ["rechazado", "inactivo"].includes(j.estado);
        });

        if (docReinscribir) {
          await updateDoc(doc(db, "jugadores_carnet", docReinscribir.id), datosJugador);
        } else {
          await addDoc(collection(db, "jugadores_carnet"), datosJugador);
        }
      } else {
        await addDoc(collection(db, "jugadores_carnet"), datosJugador);
      }
      setExito(true);
    } catch(e) { setError("Error al inscribir: " + e.message); }
    setLoading(false);
  }

  function abrirCropper(file, target) {
    setCropperSrc(URL.createObjectURL(file));
    setCropperTarget(target);
  }

  function handleCropSave(dataURL) {
    if (cropperTarget === "frente") setFotoFrente(dataURL);
    else if (cropperTarget === "dorso") setFotoDorso(dataURL);
    else if (cropperTarget === "carnet") setFotoCarnet(dataURL);
    URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
    setCropperTarget(null);
  }

  function handleCropCancel() {
    URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
    setCropperTarget(null);
  }

  if (cargando) return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif" }}>
      <div style={{ color:"#1e3a4a", fontSize:14 }}>Cargando...</div>
    </div>
  );

  if (inscripcionCerrada) return (
    <div style={{ minHeight:"100vh", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", padding:"3rem 2rem", textAlign:"center" }}>
      <div>
        <h2 style={{ color:"#1e3a4a", marginBottom:"1rem" }}>Inscripción cerrada</h2>
        <p style={{ color:"#4a6070", marginBottom:"0.5rem" }}>El período de inscripción para este torneo ha finalizado.</p>
        <p style={{ color:"#4a6070" }}>Consultá con tu club para más información.</p>
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
      {mostrarInstrucciones && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"5vh 5vw", boxSizing:"border-box" }}>
          <div style={{ background:"#1a2f4a", borderRadius:16, width:"100%", height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
            <button onClick={cerrarModalInstrucciones} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:28, cursor:"pointer", zIndex:1, lineHeight:1 }}>×</button>
            <div style={{ flex:1, overflowY:"auto" }}>
              <img src="/instrucciones-inscripcion.png" style={{ width:"100%", objectFit:"contain", display:"block" }} />
            </div>
            <div style={{ padding:"12px 16px 16px", background:"#1a2f4a" }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, cursor:"pointer" }}>
                <input type="checkbox" checked={noMostrarDenuevo} onChange={e => setNoMostrarDenuevo(e.target.checked)} />
                <span style={{ color:"rgba(255,255,255,0.7)", fontSize:13 }}>No mostrar de nuevo</span>
              </label>
              <button onClick={cerrarModalInstrucciones} style={{ width:"100%", background:"#c9a84c", color:"#1e3a4a", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"0.5px" }}>EMPEZAR INSCRIPCIÓN</button>
            </div>
          </div>
        </div>
      )}
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

        {cropperSrc ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            <ImageCropper
              imageSrc={cropperSrc}
              mode={cropperTarget === "carnet" ? "carnet" : "dni"}
              onSave={handleCropSave}
              onCancel={handleCropCancel}
            />
            <button style={estilos.btnGris} onClick={handleCropCancel}>Cancelar</button>
          </div>
        ) : (
          <>
            {paso === 1 && (
              <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
                  📌 Subí las dos fotos de tu DNI. El sistema leerá los datos automáticamente.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={estilos.label}>Frente del DNI</label>
                    <label style={{ display:"block", background: fotoFrente ? "#e8f5ee" : "white", border:`2px dashed ${fotoFrente ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, cursor:"pointer", overflow:"hidden" }}>
                      {fotoFrente ? (
                        <img src={fotoFrente} alt="DNI frente" style={{ width:"100%", aspectRatio:"85.6/54", objectFit:"cover", display:"block" }} />
                      ) : (
                        <div style={{ padding:"1.5rem 1rem", textAlign:"center" }}>
                          <div style={{ fontSize:28 }}>📄</div>
                          <div style={{ fontSize:12, color:"#8a9eaa", marginTop:4 }}>Tocar para subir</div>
                        </div>
                      )}
                      <input type="file" accept="image/*" capture="environment" onChange={e => { if(e.target.files[0]) { abrirCropper(e.target.files[0], "frente"); e.target.value = ""; } }} style={{ display:"none" }} />
                    </label>
                  </div>
                  <div>
                    <label style={estilos.label}>Dorso del DNI</label>
                    <label style={{ display:"block", background: fotoDorso ? "#e8f5ee" : "white", border:`2px dashed ${fotoDorso ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, cursor:"pointer", overflow:"hidden" }}>
                      {fotoDorso ? (
                        <img src={fotoDorso} alt="DNI dorso" style={{ width:"100%", aspectRatio:"85.6/54", objectFit:"cover", display:"block" }} />
                      ) : (
                        <div style={{ padding:"1.5rem 1rem", textAlign:"center" }}>
                          <div style={{ fontSize:28 }}>🔄</div>
                          <div style={{ fontSize:12, color:"#8a9eaa", marginTop:4 }}>Tocar para subir</div>
                        </div>
                      )}
                      <input type="file" accept="image/*" capture="environment" onChange={e => { if(e.target.files[0]) { abrirCropper(e.target.files[0], "dorso"); e.target.value = ""; } }} style={{ display:"none" }} />
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
                      <img src={fotoCarnet} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    ) : (
                      <>
                        <div style={{ width:100, height:133, border:"2.5px solid #c9a84c", borderRadius:4, opacity:0.8 }} />
                        <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, position:"absolute", bottom:10 }}>Tocá para sacar foto</div>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="user" onChange={e => { if(e.target.files[0]) { abrirCropper(e.target.files[0], "carnet"); e.target.value = ""; } }} style={{ display:"none" }} />
                  </label>
                </div>
                {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
                <button style={{ ...estilos.btn, opacity: loading ? 0.7 : 1 }} onClick={confirmarInscripcion} disabled={loading}>
                  {loading ? progreso || "Inscribiendo..." : "Confirmar inscripción"}
                </button>
                <button style={estilos.btnGris} onClick={() => setPaso(2)}>← Volver</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
