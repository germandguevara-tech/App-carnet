import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { BrowserMultiFormatReader } from "@zxing/library";
import { subirFotoADrive, generarNombreCarnet, generarNombreDniFrente, generarNombreDniDorso } from "../../utils/drive";

const estilos = {
  btn: { width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer" },
  btnGris: { width:"100%", background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" },
  input: { width:"100%", padding:"12px 14px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", background:"white" },
  label: { fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 },
  stepDot: (activo, done) => ({ width:28, height:28, borderRadius:"50%", background: done ? "#c9a84c" : activo ? "#1e3a4a" : "#ede5d5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color: done||activo ? "white" : "#8a9eaa", flexShrink:0 }),
  stepLine: (done) => ({ flex:1, height:2, background: done ? "#c9a84c" : "#ede5d5" }),
};

function parsearDNI(texto) {
  const partes = texto.split("@");
  if (partes.length >= 5) {
    return {
      apellido: partes[1]?.trim() || "",
      nombre: partes[2]?.trim() || "",
      dni: partes[4]?.trim()?.replace(/\./g,"") || "",
      fechaNacimiento: partes[6]?.trim() || "",
      tipo: "PDF417 (DNI viejo)"
    };
  }
  const mrzMatch = texto.match(/([A-Z]+)<<([A-Z<]+)\n(\d{7})[A-Z](\d{7})[A-Z]/);
  if (mrzMatch) {
    return {
      apellido: mrzMatch[1]?.replace(/</g," ").trim() || "",
      nombre: mrzMatch[2]?.replace(/</g," ").trim() || "",
      dni: mrzMatch[3] || "",
      fechaNacimiento: "",
      tipo: "MRZ (DNI nuevo)"
    };
  }
  return null;
}

export default function Inscripcion({ clubData, userData, onVolver }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState({ apellido:"", nombre:"", dni:"", fechaNacimiento:"", categoria:"" });
  const [fotoFrente, setFotoFrente] = useState(null);
  const [fotoDorso, setFotoDorso] = useState(null);
  const [fotoCarnet, setFotoCarnet] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [escaneado, setEscaneado] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const videoRef = useRef(null);
  const codeReader = useRef(null);
  const permitirGaleria = clubData?.permitirGaleria || false;

  useEffect(() => { cargarCategorias(); }, [clubData]);

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

  async function leerCodigoDeImagen(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const codeReaderInst = new BrowserMultiFormatReader();
            const result = await codeReaderInst.decodeFromCanvas(canvas);
            resolve(result?.getText() || null);
          } catch {
            resolve(null);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function procesarFotos() {
    setError("");
    setEscaneando(true);
    let texto = null;
    if (fotoFrente) texto = await leerCodigoDeImagen(fotoFrente);
    if (!texto && fotoDorso) texto = await leerCodigoDeImagen(fotoDorso);
    setEscaneando(false);
    if (texto) {
      const parsed = parsearDNI(texto);
      if (parsed) {
        setDatos(prev => ({ ...prev, ...parsed }));
        setEscaneado(true);
        return;
      }
    }
    setError("No se pudo leer el código del DNI. Intentá con la cámara.");
  }

  async function iniciarEscaneo() {
    setEscaneando(true);
    setError("");
    codeReader.current = new BrowserMultiFormatReader();
    try {
      await codeReader.current.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          const texto = result.getText();
          const parsed = parsearDNI(texto);
          if (parsed) {
            setDatos(prev => ({ ...prev, ...parsed }));
            setEscaneado(true);
            setEscaneando(false);
            codeReader.current?.reset();
          }
        }
      });
    } catch(e) {
      setError("No se pudo acceder a la cámara");
      setEscaneando(false);
    }
  }

  function detenerEscaneo() {
    codeReader.current?.reset();
    setEscaneando(false);
  }

  function handleFotoFrente(e) {
    const file = e.target.files[0];
    if (file) setFotoFrente(file);
  }

  function handleFotoDorso(e) {
    const file = e.target.files[0];
    if (file) setFotoDorso(file);
  }

  function handleFotoCarnet(e) {
    const file = e.target.files[0];
    if (file) setFotoCarnet(file);
  }

  async function confirmarInscripcion() {
    if (!datos.apellido || !datos.nombre || !datos.dni || !datos.categoria) {
      setError("Completá todos los campos"); return;
    }
    if (!fotoCarnet) {
      setError("Falta la foto carnet"); return;
    }
    setLoading(true);
    setError("");
    try {
      const torneoNombre = clubData?.torneoNombre || "Torneo";
      const clubNombre = clubData?.nombre || "Club";

      let urlCarnet = "";
      let urlDniFrente = "";
      let urlDniDorso = "";

      if (fotoCarnet) {
        const nombre = generarNombreCarnet(datos.apellido, datos.nombre, datos.categoria);
        const result = await subirFotoADrive({ archivo: fotoCarnet, nombreArchivo: nombre, torneoNombre, clubNombre });
        urlCarnet = result.url;
      }

      if (fotoFrente) {
        const nombre = generarNombreDniFrente(datos.apellido, datos.nombre, datos.dni);
        const result = await subirFotoADrive({ archivo: fotoFrente, nombreArchivo: nombre, torneoNombre, clubNombre });
        urlDniFrente = result.url;
      }

      if (fotoDorso) {
        const nombre = generarNombreDniDorso(datos.apellido, datos.nombre, datos.dni);
        const result = await subirFotoADrive({ archivo: fotoDorso, nombreArchivo: nombre, torneoNombre, clubNombre });
        urlDniDorso = result.url;
      }

      await addDoc(collection(db, "jugadores_carnet"), {
        apellido: datos.apellido,
        nombre: datos.nombre,
        dni: datos.dni,
        fechaNacimiento: datos.fechaNacimiento,
        categoria: datos.categoria,
        clubId: userData.clubId,
        torneoId: clubData.torneoId,
        estado: "pendiente",
        creadoEn: new Date(),
        fotoCarnetUrl: urlCarnet,
        fotoDniFrente: urlDniFrente,
        fotoDniDorso: urlDniDorso,
      });
      setExito(true);
    } catch(e) {
      setError("Error al inscribir: " + e.message);
    }
    setLoading(false);
  }

  if (exito) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1rem", padding:"2rem", textAlign:"center" }}>
        <div style={{ width:72, height:72, background:"#e8d5a0", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>✓</div>
        <div style={{ fontSize:20, fontWeight:600, color:"#1e3a4a" }}>¡Jugador inscripto!</div>
        <div style={{ fontSize:14, color:"#4a6070" }}>La inscripción fue enviada y está pendiente de revisión.</div>
        <button style={estilos.btn} onClick={() => { setExito(false); setPaso(1); setDatos({ apellido:"", nombre:"", dni:"", fechaNacimiento:"", categoria:"" }); setFotoFrente(null); setFotoDorso(null); setFotoCarnet(null); setEscaneado(false); }}>Inscribir otro</button>
        <button style={estilos.btnGris} onClick={onVolver}>Volver al inicio</button>
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
            📌 Acercate bien al documento para que el sistema pueda leer los datos automáticamente.
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={estilos.label}>Frente del DNI</label>
              <label style={{ display:"block", background: fotoFrente ? "#e8f5ee" : "white", border:`2px dashed ${fotoFrente ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, padding:"1.25rem", textAlign:"center", cursor:"pointer" }}>
                <div style={{ fontSize:24 }}>{fotoFrente ? "✓" : "📄"}</div>
                <div style={{ fontSize:12, color: fotoFrente ? "#1a6e4a" : "#8a9eaa", marginTop:4 }}>{fotoFrente ? fotoFrente.name.slice(0,15)+"..." : "Subir foto"}</div>
                <input type="file" accept="image/*" capture="environment" onChange={handleFotoFrente} style={{ display:"none" }} />
              </label>
            </div>
            <div>
              <label style={estilos.label}>Dorso del DNI</label>
              <label style={{ display:"block", background: fotoDorso ? "#e8f5ee" : "white", border:`2px dashed ${fotoDorso ? "#1a6e4a" : "#ede5d5"}`, borderRadius:12, padding:"1.25rem", textAlign:"center", cursor:"pointer" }}>
                <div style={{ fontSize:24 }}>{fotoDorso ? "✓" : "🔄"}</div>
                <div style={{ fontSize:12, color: fotoDorso ? "#1a6e4a" : "#8a9eaa", marginTop:4 }}>{fotoDorso ? fotoDorso.name.slice(0,15)+"..." : "Subir foto"}</div>
                <input type="file" accept="image/*" capture="environment" onChange={handleFotoDorso} style={{ display:"none" }} />
              </label>
            </div>
          </div>

          {!escaneado && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {fotoFrente || fotoDorso ? (
                <button style={{ ...estilos.btn, background:"#2e5266" }} onClick={procesarFotos} disabled={escaneando}>
                  {escaneando ? "Leyendo código..." : "🔍 Leer código del DNI"}
                </button>
              ) : (
                <div style={{ background:"#f5f0e8", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#8a9eaa", textAlign:"center" }}>
                  Subí las fotos del DNI para continuar
                </div>
              )}
              {!escaneando && (fotoFrente || fotoDorso) && (
                <button style={{ ...estilos.btnGris }} onClick={iniciarEscaneo}>
                  📷 Usar cámara como alternativa
                </button>
              )}
              {escaneando && (
                <div>
                  <video ref={videoRef} style={{ width:"100%", borderRadius:12, background:"#1a1a2e" }} autoPlay />
                  <button style={{ ...estilos.btnGris, marginTop:8 }} onClick={detenerEscaneo}>Cancelar</button>
                </div>
              )}
            </div>
          )}

          {escaneado && (
            <div style={{ background:"white", border:"1.5px solid #c9a84c", borderRadius:12, padding:"1rem" }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#c9a84c", marginBottom:8 }}>✓ Datos del jugador</div>
              {[
                { label:"Apellido/s", key:"apellido" },
                { label:"Nombre/s", key:"nombre" },
                { label:"DNI", key:"dni" },
                { label:"Fecha de nac.", key:"fechaNacimiento" },
              ].map(d => (
                <div key={d.key} style={{ marginBottom:8 }}>
                  <label style={estilos.label}>{d.label}</label>
                  <input
                    type={d.key === "fechaNacimiento" ? "date" : "text"}
                    style={estilos.input}
                    value={datos[d.key] || ""}
                    onChange={e => setDatos({...datos, [d.key]: e.target.value})}
                  />
                </div>
              ))}
            </div>
          )}

          {escaneado && (
            <button style={estilos.btn} onClick={() => setPaso(2)}>Continuar →</button>
          )}

          {error && (
            <div>
              <div style={{ color:"#c0392b", fontSize:13, marginBottom:8 }}>{error}</div>
              <button
                style={{ ...estilos.btnGris, fontSize:13, padding:"10px" }}
                onClick={() => {
                  setError("");
                  setEscaneado(true);
                }}
              >
                ✏️ Completar datos manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {paso === 2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Foto carnet</div>
          <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
            📸 Encuadrá el rostro — cara y hombros, fondo claro. Proporción 3×4.
          </div>

          <div style={{ display:"flex", justifyContent:"center" }}>
            <label style={{ display:"block", background: fotoCarnet ? "#e8f5ee" : "#1a1a2e", border:`2px solid ${fotoCarnet ? "#1a6e4a" : "rgba(201,168,76,0.4)"}`, borderRadius:10, width:180, height:240, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", position:"relative", overflow:"hidden" }}>
              {fotoCarnet ? (
                <img src={URL.createObjectURL(fotoCarnet)} alt="carnet" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <>
                  <div style={{ width:100, height:133, border:"2.5px solid #c9a84c", borderRadius:4, opacity:0.8 }} />
                  <div style={{ color:"rgba(255,255,255,0.6)", fontSize:11, position:"absolute", bottom:10 }}>Tocá para sacar foto</div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, position:"absolute", top:8, textTransform:"uppercase", letterSpacing:"0.8px" }}>3 × 4</div>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture={permitirGaleria ? undefined : "user"}
                onChange={handleFotoCarnet}
                style={{ display:"none" }}
              />
            </label>
          </div>

          {fotoCarnet && <button style={estilos.btn} onClick={() => setPaso(3)}>Continuar →</button>}
          <button style={estilos.btnGris} onClick={() => setPaso(1)}>← Volver</button>
        </div>
      )}

      {paso === 3 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1e3a4a" }}>Revisión y categoría</div>

          <div style={{ background:"white", border:"1px solid #ede5d5", borderRadius:12, padding:"1rem" }}>
            {[
              { label:"Apellido/s", val:datos.apellido },
              { label:"Nombre/s", val:datos.nombre },
              { label:"DNI", val:datos.dni },
              { label:"Fecha de nac.", val:datos.fechaNacimiento },
            ].map(d => (
              <div key={d.label} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"8px 0", borderBottom:"1px solid #f5f0e8" }}>
                <span style={{ color:"#8a9eaa" }}>{d.label}</span>
                <span style={{ fontWeight:600 }}>{d.val || "—"}</span>
              </div>
            ))}
          </div>

          <div>
            <label style={estilos.label}>Categoría</label>
            <select style={estilos.input} value={datos.categoria} onChange={e => setDatos({...datos, categoria:e.target.value})}>
              <option value="">— Seleccioná la categoría —</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
          </div>

          {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
          <button style={estilos.btn} onClick={confirmarInscripcion} disabled={loading}>{loading ? "Inscribiendo..." : "Confirmar inscripción"}</button>
          <button style={estilos.btnGris} onClick={() => setPaso(2)}>← Volver</button>
        </div>
      )}
    </div>
  );
}
