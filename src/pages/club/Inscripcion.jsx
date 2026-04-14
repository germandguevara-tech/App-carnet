import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { subirFotoADrive, generarNombreCarnet, generarNombreDniFrente, generarNombreDniDorso } from "../../utils/drive";

const estilos = {
  btn: { width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer" },
  btnGris: { width:"100%", background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" },
  input: { width:"100%", padding:"12px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", background:"white", color:"#1a2e38", WebkitTextFillColor:"#1a2e38" },
  label: { fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 },
  stepDot: (activo, done) => ({ width:28, height:28, borderRadius:"50%", background: done ? "#c9a84c" : activo ? "#1e3a4a" : "#ede5d5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color: done||activo ? "white" : "#8a9eaa", flexShrink:0 }),
  stepLine: (done) => ({ flex:1, height:2, background: done ? "#c9a84c" : "#ede5d5" }),
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
      if (dni || apellido) {
        return { dni, apellido, nombre, fechaNacimiento, fuente: "MRZ" };
      }
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
          apellido = candidato;
          break;
        }
        j++;
      }
    }
    if (linea.match(/^Nombre|^Name/i) && !linea.match(/Nacimiento|birth/i)) {
      const val = siguiente
        .replace(/EXTRANJERO/gi, "")
        .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "")
        .trim();
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
  if (apellido || nombre || dni) return { apellido, nombre, dni, fechaNacimiento, fuente: "OCR" };
  return null;
}

function combinarDatos(resultados) {
  const combined = { apellido:"", nombre:"", dni:"", fechaNacimiento:"" };

  function fechaValida(f) {
    if (!f) return false;
    const partes = f.split("-");
    if (partes.length !== 3) return false;
    const mes = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
  }

  for (const r of resultados) {
    if (!r) continue;
    if (!combined.apellido && r.apellido && !r.apellido.toLowerCase().includes("document") && !r.apellido.toUpperCase().includes("EXTRANJERO")) combined.apellido = r.apellido;
    if (!combined.nombre && r.nombre && !r.nombre.toLowerCase().includes("document") && !r.nombre.toUpperCase().includes("EXTRANJERO")) combined.nombre = r.nombre;
    if (!combined.dni && r.dni) combined.dni = r.dni;
    if (!combined.fechaNacimiento && r.fechaNacimiento && fechaValida(r.fechaNacimiento)) combined.fechaNacimiento = r.fechaNacimiento;
  }
  return combined;
}

async function leerTextoDeImagen(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        const mimeType = file.type;
        const response = await fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ action:"leerDNI", base64, mimeType })
        });
        const data = await response.json();
        resolve(data.ok ? data.texto : null);
      } catch(e) {
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

export default function Inscripcion({ clubData, userData, onVolver, jugadorAReinscribir }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState({ apellido:"", nombre:"", dni:"", fechaNacimiento:"", categoria:"" });
  const [fotoFrente, setFotoFrente] = useState(null);
  const [fotoDorso, setFotoDorso] = useState(null);
  const [fotoCarnet, setFotoCarnet] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const permitirGaleria = clubData?.permitirGaleria || false;

  useEffect(() => { cargarCategorias(); }, [clubData]);
  useEffect(() => {
    if (jugadorAReinscribir) {
      setDatos({
        apellido: jugadorAReinscribir.apellido || "",
        nombre: jugadorAReinscribir.nombre || "",
        dni: jugadorAReinscribir.dni || "",
        fechaNacimiento: jugadorAReinscribir.fechaNacimiento || "",
        categoria: jugadorAReinscribir.categoria || ""
      });
      setPaso(2);
    }
  }, [jugadorAReinscribir]);

  async function cargarCategorias() {
    if (!clubData?.torneoId) return;
    const snapTorneo = await getDocs(query(collection(db, "torneos_carnet"), where("__name__", "==", clubData.torneoId)));
    if (!snapTorneo.empty) {
      const torneoData = snapTorneo.docs[0].data();
      clubData.torneoNombre = torneoData.nombre;
      const ids = torneoData.categorias || [];
      if (ids.length > 0) {
        const snapCats = await getDocs(collection(db, "categorias_carnet"));
        const todas = snapCats.docs.map(d => ({ id:d.id, ...d.data() }));
        setCategorias(todas.filter(c => ids.includes(c.id)));
      }
    }
  }

  async function irPaso2() {
    if (!fotoFrente || !fotoDorso) { setError("Tenés que subir las dos fotos del DNI"); return; }
    setError("");
    setProcesando(true);
    try {
      const [textoFrente, textoDorso] = await Promise.all([
        leerTextoDeImagen(fotoFrente),
        leerTextoDeImagen(fotoDorso)
      ]);
      console.log("Texto frente:", textoFrente);
      console.log("Texto dorso:", textoDorso);
      const mrzFrente = textoFrente ? parsearMRZ(textoFrente) : null;
      const mrzDorso = textoDorso ? parsearMRZ(textoDorso) : null;
      const ocrFrente = textoFrente ? parsearOCR(textoFrente) : null;
      const ocrDorso = textoDorso ? parsearOCR(textoDorso) : null;
      console.log("MRZ frente:", mrzFrente);
      console.log("MRZ dorso:", mrzDorso);
      console.log("OCR frente:", ocrFrente);
      console.log("OCR dorso:", ocrDorso);
      const mrzPriority = mrzDorso || mrzFrente;
      const ocrPriority = ocrFrente || ocrDorso;
      const resultado = combinarDatos([mrzPriority, ocrPriority]);
      console.log("Resultado final:", resultado);
      if (resultado.apellido || resultado.nombre || resultado.dni) {
        setDatos(prev => ({ ...prev, ...resultado }));
      }
    } catch(e) {
      console.log("Error:", e.message);
    }
    setProcesando(false);
    setPaso(2);
  }

  async function confirmarInscripcion() {
    if (!datos.apellido || !datos.nombre || !datos.dni || !datos.categoria) {
      setError("Completá todos los campos"); return;
    }
    if (!fotoCarnet) { setError("Falta la foto carnet"); return; }
    setLoading(true); setError("");
    try {
      const torneoNombre = clubData?.torneoNombre || "Torneo";
      const clubNombre = clubData?.nombre || "Club";
      let urlCarnet = "", urlDniFrente = "", urlDniDorso = "";

      if (fotoCarnet) {
        const nombre = generarNombreCarnet(datos.apellido, datos.nombre, datos.categoria);
        const result = await subirFotoADrive({ archivo:fotoCarnet, nombreArchivo:nombre, torneoNombre, clubNombre });
        urlCarnet = result.url;
      }
      if (fotoFrente) {
        const nombre = generarNombreDniFrente(datos.apellido, datos.nombre, datos.dni);
        const result = await subirFotoADrive({ archivo:fotoFrente, nombreArchivo:nombre, torneoNombre, clubNombre });
        urlDniFrente = result.url;
      }
      if (fotoDorso) {
        const nombre = generarNombreDniDorso(datos.apellido, datos.nombre, datos.dni);
        const result = await subirFotoADrive({ archivo:fotoDorso, nombreArchivo:nombre, torneoNombre, clubNombre });
        urlDniDorso = result.url;
      }

      const snapExistente = await getDocs(query(
        collection(db, "jugadores_carnet"),
        where("dni", "==", datos.dni),
        where("clubId", "==", userData.clubId)
      ));

      console.log("Documentos encontrados con ese DNI en este club:", snapExistente.size);
      snapExistente.docs.forEach(d => console.log("Doc encontrado:", d.id, d.data().dni, d.data().clubId, d.data().estado));

      const datosJugador = {
        apellido: datos.apellido,
        nombre: datos.nombre,
        dni: datos.dni,
        fechaNacimiento: datos.fechaNacimiento,
        categoria: datos.categoria,
        clubId: userData.clubId,
        torneoId: clubData.torneoId,
        estado: "pendiente",
        motivoRechazo: "",
        fotoCarnetUrl: urlCarnet,
        fotoDniFrente: urlDniFrente,
        fotoDniDorso: urlDniDorso,
        creadoEn: new Date(),
      };

      if (!snapExistente.empty) {
        await updateDoc(doc(db, "jugadores_carnet", snapExistente.docs[0].id), datosJugador);
      } else {
        await addDoc(collection(db, "jugadores_carnet"), datosJugador);
      }

      setExito(true);
    } catch(e) { setError("Error al inscribir: " + e.message); }
    setLoading(false);
  }

  function resetear() {
    setExito(false); setPaso(1);
    setDatos({ apellido:"", nombre:"", dni:"", fechaNacimiento:"", categoria:"" });
    setFotoFrente(null); setFotoDorso(null); setFotoCarnet(null); setError("");
  }

  if (exito) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1rem", padding:"2rem", textAlign:"center" }}>
      <div style={{ width:72, height:72, background:"#e8d5a0", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>✓</div>
      <div style={{ fontSize:20, fontWeight:600, color:"#1e3a4a" }}>¡Jugador inscripto!</div>
      <div style={{ fontSize:14, color:"#4a6070" }}>La inscripción fue enviada y está pendiente de revisión.</div>
      <button style={estilos.btn} onClick={resetear}>Inscribir otro</button>
      <button style={estilos.btnGris} onClick={onVolver}>Volver al inicio</button>
    </div>
  );

  const torneoActivo = clubData?.torneoActivo === true;
  const clubHabilitado = clubData?.habilitado !== false;
  const puedeInscribir = torneoActivo || clubHabilitado;

  if (clubData && !puedeInscribir) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1rem", padding:"2rem", textAlign:"center" }}>
        <div style={{ fontSize:48 }}>🔒</div>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>Inscripción cerrada</div>
        <div style={{ fontSize:14, color:"#4a6070" }}>La inscripción no está habilitada en este momento.</div>
        <button style={{ background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:600, cursor:"pointer" }} onClick={onVolver}>Volver</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem" }}>
        <button onClick={onVolver} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#1e3a4a" }}>←</button>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>Inscribir jugador</div>
      </div>

      <div style={{ display:"flex", alignItems:"center", marginBottom:"1.5rem" }}>
        {[1,2,3].map((n, i) => (
          <div key={n} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : 0 }}>
            <div style={estilos.stepDot(paso===n, paso>n)}>{paso>n ? "✓" : n}</div>
            {i < 2 && <div style={estilos.stepLine(paso>n)} />}
          </div>
        ))}
      </div>

      {paso === 1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Fotos del DNI</div>
          <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
            📌 Subí las dos fotos del DNI para continuar. El sistema intentará leer los datos automáticamente.
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
          <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Datos del jugador</div>
          <div>
            <label style={estilos.label}>Apellido/s</label>
            <input style={estilos.input} value={datos.apellido} onChange={e => setDatos({...datos, apellido:e.target.value})} placeholder="Apellido/s" />
          </div>
          <div>
            <label style={estilos.label}>Nombre/s</label>
            <input style={estilos.input} value={datos.nombre} onChange={e => setDatos({...datos, nombre:e.target.value})} placeholder="Nombre/s" />
          </div>
          <div>
            <label style={estilos.label}>DNI</label>
            <input style={estilos.input} value={datos.dni} onChange={e => setDatos({...datos, dni:e.target.value})} placeholder="Número de documento" />
          </div>
          <div>
            <label style={estilos.label}>Fecha de nacimiento</label>
            <input type="date" style={estilos.input} value={datos.fechaNacimiento} onChange={e => setDatos({...datos, fechaNacimiento:e.target.value})} />
          </div>
          <div>
            <label style={estilos.label}>Categoría</label>
            <select style={{ ...estilos.input, appearance:"none", color:"#1a2e38", WebkitTextFillColor:"#1a2e38" }} value={datos.categoria} onChange={e => setDatos({...datos, categoria:e.target.value})}>
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
            📸 Encuadrá el rostro — cara y hombros, fondo claro. Proporción 3×4.
          </div>
          <div style={{ display:"flex", justifyContent:"center" }}>
            <label style={{ display:"flex", background: fotoCarnet ? "#e8f5ee" : "#1a1a2e", border:`2px solid ${fotoCarnet ? "#1a6e4a" : "rgba(201,168,76,0.4)"}`, borderRadius:10, width:180, height:240, flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", position:"relative", overflow:"hidden" }}>
              {fotoCarnet ? (
                <img src={URL.createObjectURL(fotoCarnet)} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <>
                  <div style={{ width:100, height:133, border:"2.5px solid #c9a84c", borderRadius:4, opacity:0.8 }} />
                  <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, position:"absolute", bottom:10 }}>Tocá para sacar foto</div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, position:"absolute", top:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>3 × 4</div>
                </>
              )}
              <input type="file" accept="image/*" capture={permitirGaleria ? undefined : "user"} onChange={e => { if(e.target.files[0]) setFotoCarnet(e.target.files[0]); }} style={{ display:"none" }} />
            </label>
          </div>
          {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
          <button style={{ ...estilos.btn, opacity: loading ? 0.7 : 1 }} onClick={confirmarInscripcion} disabled={loading}>{loading ? "Inscribiendo..." : "Confirmar inscripción"}</button>
          <button style={estilos.btnGris} onClick={() => setPaso(2)}>← Volver</button>
        </div>
      )}
    </div>
  );
}
