import { useState, useEffect } from "react";
import { db, authSecondary, functions } from "../../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

function generarEmail(usuario) {
  return usuario.trim().toLowerCase()
    .replace(/\s+/g, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "") + "@app-carnet.com";
}

const ESTADOS_OPCIONES = [
  { id:"pendiente", label:"Pendiente" },
  { id:"habilitado", label:"Habilitado" },
  { id:"rechazado", label:"Rechazado" },
  { id:"inactivo", label:"Inactivo" },
  { id:"baja_solicitada", label:"Baja solicitada" },
];

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }),
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" },
  label: { fontSize:11, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:4 },
  card: { background:"white", borderRadius:12, padding:"1.25rem 1.5rem", border:"1px solid #ede5d5", marginBottom:"1rem" },
  th: { padding:"10px 14px", fontSize:11, fontWeight:600, color:"#8a9eaa", textTransform:"uppercase", letterSpacing:"0.6px", textAlign:"left", borderBottom:"1px solid #ede5d5", whiteSpace:"nowrap" },
  td: { padding:"12px 14px", fontSize:13, color:"#1e3a4a", borderBottom:"1px solid #f5f0e8", verticalAlign:"middle" },
};

function CheckboxEstados({ valor, onChange }) {
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
      {ESTADOS_OPCIONES.map(e => (
        <label key={e.id} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:13 }}>
          <input
            type="checkbox"
            checked={valor.includes(e.id)}
            onChange={() => onChange(e.id)}
          />
          {e.label}
        </label>
      ))}
    </div>
  );
}

function ModalCambiarPassword({ usuario, onClose }) {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function guardar() {
    if (pass1.length < 6) { setError("Mínimo 6 caracteres"); return; }
    if (pass1 !== pass2) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true); setError("");
    try {
      const fn = httpsCallable(functions, "cambiarPasswordUsuario");
      await fn({ uid: usuario.uid, nuevaPassword: pass1 });
      setOk(true);
    } catch(err) { setError("Error: " + (err.message || "No se pudo cambiar")); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100 }}>
      <div style={{ background:"white", borderRadius:16, padding:"2rem", width:"100%", maxWidth:380 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a" }}>🔑 Cambiar contraseña</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"cursor", color:"#8a9eaa" }}>×</button>
        </div>
        <div style={{ fontSize:13, color:"#4a6070", marginBottom:"1rem" }}>{usuario.usuario || usuario.email}</div>
        {ok ? (
          <div style={{ color:"#1a6e4a", fontSize:13, fontWeight:600 }}>✅ Contraseña actualizada correctamente.</div>
        ) : (
          <>
            <div style={{ marginBottom:12 }}>
              <label style={s.label}>Nueva contraseña</label>
              <input type="password" style={s.input} value={pass1} onChange={e => setPass1(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={s.label}>Confirmar contraseña</label>
              <input type="password" style={s.input} value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repetir contraseña" />
            </div>
            {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:8 }}>{error}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button style={s.btn} onClick={guardar} disabled={loading}>{loading ? "Guardando..." : "Guardar"}</button>
              <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalEditar({ viz, torneos, onClose }) {
  const [torneoId, setTorneoId] = useState(viz.torneoId || "");
  const [estadosVisibles, setEstadosVisibles] = useState(viz.estadosVisibles || []);
  const [verCarnets, setVerCarnets] = useState(viz.verCarnets || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleEstado(id) {
    setEstadosVisibles(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }

  async function guardar() {
    if (!torneoId) { setError("Seleccioná un torneo"); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, "Usuarios", viz.docId), { torneoId, estadosVisibles, verCarnets });
      onClose();
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}>
      <div style={{ background:"white", borderRadius:16, padding:"2rem", width:"100%", maxWidth:460 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
          <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a" }}>✏️ Editar visualizador</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#8a9eaa" }}>×</button>
        </div>
        <div style={{ fontSize:13, color:"#4a6070", marginBottom:"1rem" }}>{viz.usuario || viz.email}</div>

        <div style={{ marginBottom:"1rem" }}>
          <label style={s.label}>Torneo asignado</label>
          <select style={s.input} value={torneoId} onChange={e => setTorneoId(e.target.value)}>
            <option value="">— Seleccioná —</option>
            {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <label style={{ ...s.label, marginBottom:8 }}>Estados que puede ver</label>
          <CheckboxEstados valor={estadosVisibles} onChange={toggleEstado} />
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, marginBottom:"1.5rem" }}>
          <input type="checkbox" checked={verCarnets} onChange={e => setVerCarnets(e.target.checked)} />
          Puede ver carnets digitales
        </label>

        {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:8 }}>{error}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btn} onClick={guardar} disabled={loading}>{loading ? "Guardando..." : "Guardar cambios"}</button>
          <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function Visualizadores() {
  const [visualizadores, setVisualizadores] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ usuario:"", password:"", torneoId:"", estadosVisibles:[], verCarnets:false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalEditar, setModalEditar] = useState(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);
  const [modalCambiarPass, setModalCambiarPass] = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const snapT = await getDocs(collection(db, "torneos_carnet"));
    setTorneos(snapT.docs.map(d => ({ id:d.id, ...d.data() })));
    const snapV = await getDocs(query(collection(db, "Usuarios"), where("rol", "==", "visualizador")));
    setVisualizadores(snapV.docs.map(d => ({ docId:d.id, ...d.data() })));
  }

  function toggleEstadoForm(id) {
    setForm(prev => ({
      ...prev,
      estadosVisibles: prev.estadosVisibles.includes(id)
        ? prev.estadosVisibles.filter(e => e !== id)
        : [...prev.estadosVisibles, id],
    }));
  }

  async function crearVisualizador() {
    if (!form.usuario || !form.password || !form.torneoId) { setError("Completá usuario, contraseña y torneo"); return; }
    setLoading(true); setError("");
    try {
      const existe = await getDocs(query(collection(db, "Usuarios"), where("usuario", "==", form.usuario)));
      if (!existe.empty) { setError("El nombre de usuario ya está en uso. Elegí otro."); setLoading(false); return; }
      const email = generarEmail(form.usuario);
      const cred = await createUserWithEmailAndPassword(authSecondary, email, form.password);
      await addDoc(collection(db, "Usuarios"), {
        usuario: form.usuario,
        email,
        Rol: "visualizador",
        rol: "visualizador",
        uid: cred.user.uid,
        torneoId: form.torneoId,
        estadosVisibles: form.estadosVisibles,
        verCarnets: form.verCarnets,
      });
      setForm({ usuario:"", password:"", torneoId:"", estadosVisibles:[], verCarnets:false });
      setMostrarForm(false);
      await cargarDatos();
    } catch(err) { setError("Error: " + err.message); }
    setLoading(false);
  }

  async function eliminar(docId) {
    await deleteDoc(doc(db, "Usuarios", docId));
    setConfirmandoEliminar(null);
    await cargarDatos();
  }

  function getNombreTorneo(id) {
    return torneos.find(t => t.id === id)?.nombre || "—";
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>👁️ Visualizadores</div>
        <button style={s.btn} onClick={() => setMostrarForm(!mostrarForm)}>+ Nuevo visualizador</button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={s.label}>Usuario</label>
              <input type="text" style={s.input} value={form.usuario} onChange={e => setForm({...form, usuario:e.target.value})} placeholder="ej: vista2026" />
            </div>
            <div>
              <label style={s.label}>Contraseña</label>
              <input type="password" style={s.input} value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label style={s.label}>Torneo asignado</label>
              <select style={s.input} value={form.torneoId} onChange={e => setForm({...form, torneoId:e.target.value})}>
                <option value="">— Seleccioná —</option>
                {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ ...s.label, marginBottom:8 }}>Estados visibles</label>
            <CheckboxEstados valor={form.estadosVisibles} onChange={toggleEstadoForm} />
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13, marginBottom:14 }}>
            <input type="checkbox" checked={form.verCarnets} onChange={e => setForm({...form, verCarnets:e.target.checked})} />
            Puede ver carnets digitales
          </label>

          {error && <div style={{ color:"#c0392b", fontSize:12, marginBottom:8 }}>{error}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={crearVisualizador} disabled={loading}>{loading ? "Creando..." : "Crear visualizador"}</button>
            <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={() => { setMostrarForm(false); setError(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f5f0e8" }}>
            <tr>
              <th style={s.th}>Email</th>
              <th style={s.th}>Torneo</th>
              <th style={s.th}>Estados visibles</th>
              <th style={{ ...s.th, textAlign:"center" }}>Carnets</th>
              <th style={{ ...s.th, textAlign:"center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visualizadores.length === 0 && (
              <tr><td colSpan={5} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No hay visualizadores todavía.</td></tr>
            )}
            {visualizadores.map(v => (
              <tr key={v.docId}>
                <td style={s.td}>{v.usuario || v.email}</td>
                <td style={s.td}>{getNombreTorneo(v.torneoId)}</td>
                <td style={s.td}>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {(v.estadosVisibles || []).length === 0
                      ? <span style={{ fontSize:12, color:"#8a9eaa" }}>Ninguno</span>
                      : (v.estadosVisibles || []).map(e => (
                          <span key={e} style={{ background:"#f5f0e8", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#1e3a4a" }}>{e}</span>
                        ))
                    }
                  </div>
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  {v.verCarnets ? "✅" : "—"}
                </td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  {confirmandoEliminar === v.docId ? (
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button style={s.btnSm("#c0392b")} onClick={() => eliminar(v.docId)}>Confirmar</button>
                      <button style={s.btnSm("#8a9eaa")} onClick={() => setConfirmandoEliminar(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button style={s.btnSm("#1e3a4a")} onClick={() => setModalEditar(v)}>✏️ Editar</button>
                      <button style={s.btnSm("#4a6070")} onClick={() => setModalCambiarPass(v)}>🔑</button>
                      <button style={s.btnSm("#c0392b")} onClick={() => setConfirmandoEliminar(v.docId)}>🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalEditar && (
        <ModalEditar
          viz={modalEditar}
          torneos={torneos}
          onClose={() => { setModalEditar(null); cargarDatos(); }}
        />
      )}

      {modalCambiarPass && (
        <ModalCambiarPassword
          usuario={modalCambiarPass}
          onClose={() => setModalCambiarPass(null)}
        />
      )}
    </div>
  );
}
