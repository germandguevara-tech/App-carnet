import { useState, useEffect } from "react";
import { db, auth } from "../../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, orderBy, query, where } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { subirFotoADrive, urlVisualizacion } from "../../utils/drive";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }),
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" },
  inputSm: { padding:"8px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none" },
  label: { fontSize:11, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:4 },
  card: { background:"white", borderRadius:12, padding:"1.25rem 1.5rem", border:"1px solid #ede5d5", marginBottom:"1rem" },
  th: { padding:"10px 14px", fontSize:11, fontWeight:600, color:"#8a9eaa", textTransform:"uppercase", letterSpacing:"0.6px", textAlign:"left", borderBottom:"1px solid #ede5d5", whiteSpace:"nowrap" },
  td: { padding:"12px 14px", fontSize:13, color:"#1e3a4a", borderBottom:"1px solid #f5f0e8", verticalAlign:"middle" },
};

function generarNombreLogo(nombre) {
  return nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s\-]/g, "")
    .trim() + ".jpg";
}

function Switch({ value, onChange }) {
  return (
    <div onClick={onChange} style={{ width:44, height:24, borderRadius:12, background: value ? "#1a6e4a" : "#ced4da", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left: value ? 23 : 3, width:18, height:18, borderRadius:"50%", background:"white", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
    </div>
  );
}

function ModalUsuarios({ club, onClose, torneos }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ email:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { cargarUsuarios(); }, []);

  async function cargarUsuarios() {
    const snap = await getDocs(query(collection(db, "Usuarios"), where("clubId", "==", club.uid)));
    setUsuarios(snap.docs.map(d => ({ docId:d.id, ...d.data() })));
  }

  async function agregarUsuario() {
    if (!form.email || !form.password) { setError("Completá email y contraseña"); return; }
    setLoading(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await addDoc(collection(db, "Usuarios"), {
        email: form.email,
        Rol: "club", rol: "club",
        Nombre: club.nombre,
        uid: cred.user.uid,
        clubId: club.uid,
        activo: true
      });
      setForm({ email:"", password:"" });
      await cargarUsuarios();
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  async function toggleActivo(docId, actual) {
    await updateDoc(doc(db, "Usuarios", docId), { activo: !actual });
    await cargarUsuarios();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"white", borderRadius:16, padding:"2rem", width:"100%", maxWidth:560, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>👥 Usuarios — {club.nombre}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#8a9eaa" }}>×</button>
        </div>

        <div style={{ background:"#f5f0e8", borderRadius:10, padding:"1rem", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:10 }}>Agregar usuario</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="usuario@email.com" />
            </div>
            <div>
              <label style={s.label}>Contraseña</label>
              <input style={s.input} type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:8 }}>{error}</div>}
          <button style={s.btn} onClick={agregarUsuario} disabled={loading}>{loading ? "Creando..." : "Agregar usuario"}</button>
        </div>

        <div style={{ fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Usuarios del club</div>
        {usuarios.length === 0 && <div style={{ fontSize:13, color:"#8a9eaa", padding:"1rem 0" }}>No hay usuarios todavía.</div>}
        {usuarios.map(u => (
          <div key={u.docId} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f5f0e8" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"#1e3a4a" }}>{u.email}</div>
              <div style={{ fontSize:11, color: u.activo !== false ? "#1a6e4a" : "#c0392b" }}>
                {u.activo !== false ? "Activo" : "Desactivado"}
              </div>
            </div>
            <Switch value={u.activo !== false} onChange={() => toggleActivo(u.docId, u.activo !== false)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalEditarClub({ club, onClose }) {
  const [nombre, setNombre] = useState(club.nombre);
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  async function guardar() {
    if (!nombre.trim()) { setError("El nombre no puede estar vacío"); return; }
    setLoading(true);
    try {
      const updates = { nombre: nombre.trim() };
      if (archivo) {
        const { url } = await subirFotoADrive({
          archivo,
          nombreArchivo: generarNombreLogo(nombre.trim()),
          torneoNombre: "Logos",
          clubNombre: "",
        });
        updates.logoUrl = url;
      }
      await updateDoc(doc(db, "clubes_carnet", club.id), updates);
      if (preview) URL.revokeObjectURL(preview);
      onClose();
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"white", borderRadius:16, padding:"2rem", width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a" }}>✏️ Editar club</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#8a9eaa" }}>×</button>
        </div>

        <div style={{ marginBottom:"1.25rem" }}>
          <label style={s.label}>Nombre del club</label>
          <input
            style={s.input}
            value={nombre}
            onChange={e => { setNombre(e.target.value); setError(""); }}
            placeholder="Nombre del club"
          />
        </div>

        <div style={{ marginBottom:"1.25rem" }}>
          <label style={s.label}>Logo del club</label>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {(preview || club.logoUrl) && (
              <img
                src={preview || urlVisualizacion(club.logoUrl, 200)}
                style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2px solid #ede5d5", flexShrink:0 }}
              />
            )}
            <input type="file" accept="image/*" onChange={handleFile} style={{ fontSize:13 }} />
          </div>
        </div>

        {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:10 }}>{error}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btn} onClick={guardar} disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </button>
          <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function Clubes() {
  const [clubes, setClubes] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", torneoId:"" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [torneoFiltro, setTorneoFiltro] = useState("");
  const [modalUsuarios, setModalUsuarios] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const snapC = await getDocs(query(collection(db, "clubes_carnet"), orderBy("nombre")));
    setClubes(snapC.docs.map(d => ({ id:d.id, ...d.data() })));
    const snapT = await getDocs(collection(db, "torneos_carnet"));
    setTorneos(snapT.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function crearClub() {
    if (!form.nombre || !form.email || !form.password || !form.torneoId) { setError("Completá todos los campos"); return; }
    setLoading(true); setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      let logoUrl = "";
      if (logoFile) {
        const { url } = await subirFotoADrive({
          archivo: logoFile,
          nombreArchivo: generarNombreLogo(form.nombre),
          torneoNombre: "Logos",
          clubNombre: "",
        });
        logoUrl = url;
      }
      await addDoc(collection(db, "Usuarios"), { email:form.email, Rol:"club", rol:"club", Nombre:form.nombre, uid:cred.user.uid, clubId:cred.user.uid, activo:true });
      await addDoc(collection(db, "clubes_carnet"), { nombre:form.nombre, email:form.email, torneoId:form.torneoId, uid:cred.user.uid, permitirGaleria:false, creadoEn:new Date(), logoUrl });
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setForm({ nombre:"", email:"", password:"", torneoId:"" });
      setLogoFile(null);
      setLogoPreview(null);
      setMostrarForm(false);
      await cargarDatos();
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  async function toggle(id, campo, actual) {
    await updateDoc(doc(db, "clubes_carnet", id), { [campo]: !actual });
    await cargarDatos();
  }

  function getNombreTorneo(id) {
    return torneos.find(t => t.id === id)?.nombre || "—";
  }

  function enviarWhatsapp(club) {
    const msg = encodeURIComponent(`Hola *${club.nombre}*! 👋\n\nTe enviamos tus credenciales para *App-Carnet*:\n\n📧 Usuario: ${club.email}\n🔑 Contraseña: (la que te informamos)\n\n🔗 Ingresá en: ${window.location.origin}\n\n¡Cualquier consulta avisanos!`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  const clubesFiltrados = clubes.filter(c => {
    const coincideNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideTorneo = torneoFiltro ? c.torneoId === torneoFiltro : true;
    return coincideNombre && coincideTorneo;
  });

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>🏟️ Clubes</div>
        <button style={s.btn} onClick={() => setMostrarForm(!mostrarForm)}>+ Nuevo club</button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={s.label}>Nombre del club</label>
              <input style={s.input} value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} placeholder="Club Atlético Norte" />
            </div>
            <div>
              <label style={s.label}>Email usuario principal</label>
              <input type="email" style={s.input} value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="club@email.com" />
            </div>
            <div>
              <label style={s.label}>Contraseña</label>
              <input type="password" style={s.input} value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label style={s.label}>Torneo</label>
              <select style={s.input} value={form.torneoId} onChange={e => setForm({...form, torneoId:e.target.value})}>
                <option value="">— Seleccioná —</option>
                {torneos.filter(t => t.estado === "activo").map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={s.label}>Logo del club (opcional)</label>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {logoPreview && (
                <img src={logoPreview} style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", border:"2px solid #ede5d5", flexShrink:0 }} />
              )}
              <input type="file" accept="image/*" onChange={handleLogoFile} style={{ fontSize:13 }} />
            </div>
          </div>

          {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:8 }}>{error}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={crearClub} disabled={loading}>{loading ? "Creando..." : "Crear club"}</button>
            <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:12, marginBottom:"1rem" }}>
        <input style={{ ...s.inputSm, flex:1 }} placeholder="🔍 Buscar club..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select style={s.inputSm} value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}>
          <option value="">Todos los torneos</option>
          {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>

      <div style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f5f0e8" }}>
            <tr>
              <th style={s.th}>Club</th>
              <th style={s.th}>Torneo</th>
              <th style={{ ...s.th, textAlign:"center" }}>Insc. Especial</th>
              <th style={{ ...s.th, textAlign:"center" }}>Galería</th>
              <th style={{ ...s.th, textAlign:"center" }}>Carnets</th>
              <th style={{ ...s.th, textAlign:"center" }}>Usuarios</th>
              <th style={{ ...s.th, textAlign:"center" }}>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {clubesFiltrados.length === 0 && (
              <tr><td colSpan={7} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No se encontraron clubes.</td></tr>
            )}
            {clubesFiltrados.map(c => (
              <tr key={c.id}>
                <td style={{ ...s.td, fontWeight:600 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {c.logoUrl ? (
                      <img src={urlVisualizacion(c.logoUrl, 80)} style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                    ) : (
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🏟️</div>
                    )}
                    {c.nombre}
                    <button
                      onClick={() => setModalEditar(c)}
                      title="Editar nombre"
                      style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#8a9eaa", padding:"2px 4px", lineHeight:1 }}
                    >✏️</button>
                  </div>
                </td>
                <td style={s.td}>{getNombreTorneo(c.torneoId)}</td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  {(() => {
                    const torneoEstado = torneos.find(t => t.id === c.torneoId)?.estado;
                    if (torneoEstado === "activo") return <span style={{ fontSize:11, color:"#8a9eaa" }}>—</span>;
                    return (
                      <div style={{ display:"flex", justifyContent:"center" }}>
                        <Switch value={c.inscripcionEspecial === true} onChange={() => toggle(c.id, "inscripcionEspecial", c.inscripcionEspecial === true)} />
                      </div>
                    );
                  })()}
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <Switch value={c.permitirGaleria} onChange={() => toggle(c.id, "permitirGaleria", c.permitirGaleria)} />
                  </div>
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <Switch value={c.carnetsActivos !== false} onChange={() => toggle(c.id, "carnetsActivos", c.carnetsActivos !== false)} />
                  </div>
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  <button style={s.btnSm("#1e3a4a")} onClick={() => setModalUsuarios(c)}>👤 Usuarios</button>
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  <button onClick={() => enviarWhatsapp(c)} style={{ background:"#25D366", color:"white", border:"none", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    📲 Enviar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalUsuarios && (
        <ModalUsuarios
          club={modalUsuarios}
          torneos={torneos}
          onClose={() => { setModalUsuarios(null); cargarDatos(); }}
        />
      )}

      {modalEditar && (
        <ModalEditarClub
          club={modalEditar}
          onClose={() => { setModalEditar(null); cargarDatos(); }}
        />
      )}
    </div>
  );
}
