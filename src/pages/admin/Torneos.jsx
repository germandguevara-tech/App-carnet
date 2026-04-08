import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, where } from "firebase/firestore";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }),
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" },
  inputInline: { padding:"6px 10px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:12, outline:"none", width:"100%" },
  label: { fontSize:11, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:4 },
  card: { background:"white", borderRadius:12, padding:"1.25rem 1.5rem", border:"1px solid #ede5d5", marginBottom:"1rem" },
  th: { padding:"10px 14px", fontSize:11, fontWeight:600, color:"#8a9eaa", textTransform:"uppercase", letterSpacing:"0.6px", textAlign:"left", borderBottom:"1px solid #ede5d5", whiteSpace:"nowrap" },
  td: { padding:"12px 14px", fontSize:13, color:"#1e3a4a", borderBottom:"1px solid #f5f0e8", verticalAlign:"middle" },
};

const ESTADO_COLORES = { activo:"#1a6e4a", cerrado:"#c0392b", archivado:"#8a9eaa" };
const ESTADO_BG = { activo:"#e8f5ee", cerrado:"#fdecea", archivado:"#f5f0e8" };

export default function Torneos() {
  const [torneos, setTorneos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre:"", fechaInicioInscripcion:"", fechaCierreInscripcion:"", temporada:"" });
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [catSelect, setCatSelect] = useState("");
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [catEditSelect, setCatEditSelect] = useState("");

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const q = query(collection(db, "torneos_carnet"), orderBy("creadoEn", "desc"));
    const snap = await getDocs(q);
    setTorneos(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    const snapCat = await getDocs(query(collection(db, "categorias_carnet"), orderBy("nombre")));
    setCategorias(snapCat.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  function agregarCategoria() {
    if (!catSelect || categoriasSeleccionadas.includes(catSelect)) return;
    setCategoriasSeleccionadas(prev => [...prev, catSelect]);
    setCatSelect("");
  }

  function quitarCategoria(id) {
    setCategoriasSeleccionadas(prev => prev.filter(c => c !== id));
  }

  function agregarCategoriaEdit() {
    if (!catEditSelect || formEdit.categorias?.includes(catEditSelect)) return;
    setFormEdit(prev => ({ ...prev, categorias: [...(prev.categorias||[]), catEditSelect] }));
    setCatEditSelect("");
  }

  function quitarCategoriaEdit(id) {
    setFormEdit(prev => ({ ...prev, categorias: prev.categorias.filter(c => c !== id) }));
  }

  async function crearTorneo() {
    if (!form.nombre || !form.fechaInicioInscripcion || !form.fechaCierreInscripcion) return;
    setLoading(true);
    await addDoc(collection(db, "torneos_carnet"), {
      ...form, categorias: categoriasSeleccionadas, estado:"activo", creadoEn: new Date()
    });
    setForm({ nombre:"", fechaInicioInscripcion:"", fechaCierreInscripcion:"", temporada:"" });
    setCategoriasSeleccionadas([]);
    setCatSelect("");
    setMostrarForm(false);
    await cargarDatos();
    setLoading(false);
  }

  async function cambiarEstado(id, estado) {
    await updateDoc(doc(db, "torneos_carnet", id), { estado });
    await cargarDatos();
  }

  function iniciarEdicion(t) {
    setEditando(t.id);
    setFormEdit({ nombre:t.nombre, temporada:t.temporada||"", fechaInicioInscripcion:t.fechaInicioInscripcion, fechaCierreInscripcion:t.fechaCierreInscripcion, categorias:t.categorias||[] });
    setCatEditSelect("");
  }

  async function guardarEdicion(id) {
    await updateDoc(doc(db, "torneos_carnet", id), {
      nombre: formEdit.nombre,
      temporada: formEdit.temporada,
      fechaInicioInscripcion: formEdit.fechaInicioInscripcion,
      fechaCierreInscripcion: formEdit.fechaCierreInscripcion,
      categorias: formEdit.categorias || []
    });
    setEditando(null);
    await cargarDatos();
  }

  async function eliminarTorneo(id) {
    const snap = await getDocs(query(collection(db, "clubes_carnet"), where("torneoId", "==", id)));
    if (snap.size > 0) {
      alert("No podés eliminar este torneo porque tiene clubes asociados.");
      return;
    }
    if (!confirm("¿Eliminar este torneo?")) return;
    await deleteDoc(doc(db, "torneos_carnet", id));
    await cargarDatos();
  }

  function getNombreCategoria(id) {
    return categorias.find(c => c.id === id)?.nombre || id;
  }

  function getNombreCategorias(ids) {
    if (!ids || ids.length === 0) return "—";
    return ids.map(id => getNombreCategoria(id)).join(", ");
  }

  const catDisponibles = categorias.filter(c => !categoriasSeleccionadas.includes(c.id));
  const catDisponiblesEdit = categorias.filter(c => !(formEdit.categorias||[]).includes(c.id));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>🏆 Torneos</div>
        <button style={s.btn} onClick={() => setMostrarForm(!mostrarForm)}>+ Nuevo torneo</button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, marginBottom:16 }}>
            <div>
              <label style={s.label}>Nombre del torneo</label>
              <input style={s.input} value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} placeholder="Ej: Torneo Apertura 2026" />
            </div>
            <div>
              <label style={s.label}>Temporada</label>
              <input style={s.input} value={form.temporada} onChange={e => setForm({...form, temporada:e.target.value})} placeholder="2026" />
            </div>
            <div>
              <label style={s.label}>Inicio inscripción</label>
              <input type="date" style={s.input} value={form.fechaInicioInscripcion} onChange={e => setForm({...form, fechaInicioInscripcion:e.target.value})} />
            </div>
            <div>
              <label style={s.label}>Cierre inscripción</label>
              <input type="date" style={s.input} value={form.fechaCierreInscripcion} onChange={e => setForm({...form, fechaCierreInscripcion:e.target.value})} />
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={s.label}>Categorías del torneo</label>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <select style={{ ...s.input, maxWidth:250 }} value={catSelect} onChange={e => setCatSelect(e.target.value)}>
                <option value="">— Seleccioná categoría —</option>
                {catDisponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button style={s.btn} onClick={agregarCategoria}>Agregar</button>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {categoriasSeleccionadas.map(id => (
                <span key={id} style={{ background:"#e8f5ee", border:"1px solid #1a6e4a", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#1a6e4a", display:"flex", alignItems:"center", gap:6 }}>
                  {getNombreCategoria(id)}
                  <button onClick={() => quitarCategoria(id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontWeight:700, fontSize:14, lineHeight:1 }}>×</button>
                </span>
              ))}
              {categoriasSeleccionadas.length === 0 && <span style={{ fontSize:12, color:"#8a9eaa" }}>Ninguna categoría agregada</span>}
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={crearTorneo} disabled={loading}>{loading ? "Guardando..." : "Guardar torneo"}</button>
            <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f5f0e8" }}>
            <tr>
              <th style={s.th}>Torneo</th>
              <th style={s.th}>Temporada</th>
              <th style={s.th}>Inscripción</th>
              <th style={{ ...s.th, textAlign:"center" }}>Estado</th>
              <th style={{ ...s.th, textAlign:"center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {torneos.length === 0 && (
              <tr><td colSpan={6} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No hay torneos creados todavía.</td></tr>
            )}
            {torneos.map(t => (
              editando === t.id ? (
                <tr key={t.id} style={{ background:"#fffdf5" }}>
                  <td style={s.td}><input style={s.inputInline} value={formEdit.nombre} onChange={e => setFormEdit({...formEdit, nombre:e.target.value})} /></td>
                  <td style={s.td}><input style={s.inputInline} value={formEdit.temporada} onChange={e => setFormEdit({...formEdit, temporada:e.target.value})} /></td>
                  <td style={s.td}>
                    <input type="date" style={{ ...s.inputInline, marginBottom:4 }} value={formEdit.fechaInicioInscripcion} onChange={e => setFormEdit({...formEdit, fechaInicioInscripcion:e.target.value})} />
                    <input type="date" style={s.inputInline} value={formEdit.fechaCierreInscripcion} onChange={e => setFormEdit({...formEdit, fechaCierreInscripcion:e.target.value})} />
                  </td>
                  <td style={s.td}>
                    <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                      <select style={{ ...s.inputInline, flex:1 }} value={catEditSelect} onChange={e => setCatEditSelect(e.target.value)}>
                        <option value="">— Agregar —</option>
                        {catDisponiblesEdit.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <button style={s.btnSm("#1e3a4a")} onClick={agregarCategoriaEdit}>+</button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {(formEdit.categorias||[]).map(id => (
                        <span key={id} style={{ background:"#e8f5ee", border:"1px solid #1a6e4a", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#1a6e4a", display:"flex", alignItems:"center", gap:4 }}>
                          {getNombreCategoria(id)}
                          <button onClick={() => quitarCategoriaEdit(id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontWeight:700, fontSize:12, lineHeight:1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={s.td}></td>
                  <td style={{ ...s.td, textAlign:"center" }}>
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button style={s.btnSm("#1a6e4a")} onClick={() => guardarEdicion(t.id)}>Guardar</button>
                      <button style={s.btnSm("#8a9eaa")} onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td style={{ ...s.td, fontWeight:600 }}>{t.nombre}</td>
                  <td style={s.td}>{t.temporada || "—"}</td>
                  <td style={{ ...s.td, fontSize:12 }}>{t.fechaInicioInscripcion} → {t.fechaCierreInscripcion}</td>
                  <td style={{ ...s.td, textAlign:"center" }}>
                    <span style={{ background: ESTADO_BG[t.estado], color: ESTADO_COLORES[t.estado], borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:600 }}>
                      {t.estado}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign:"center" }}>
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button style={{ background:"none", border:"1.5px solid #c9a84c", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#c9a84c" }} onClick={() => iniciarEdicion(t)}>✏️</button>
                      {t.estado === "activo" && <button style={s.btnSm("#c0392b")} onClick={() => cambiarEstado(t.id, "cerrado")}>Cerrar</button>}
                      {t.estado === "cerrado" && <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(t.id, "activo")}>Reabrir</button>}
                      {t.estado !== "archivado" && <button style={s.btnSm("#8a9eaa")} onClick={() => cambiarEstado(t.id, "archivado")}>Archivar</button>}
                      <button style={{ background:"none", border:"1.5px solid #c0392b", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:14, color:"#c0392b" }} onClick={() => eliminarTorneo(t.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
