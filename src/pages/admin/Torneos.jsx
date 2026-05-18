import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, orderBy, query, where } from "firebase/firestore";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }),
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" },
  inputSm: { padding:"4px 8px", border:"1.5px solid #ede5d5", borderRadius:6, fontSize:12, outline:"none", boxSizing:"border-box" },
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
  // categoriasSeleccionadas: [{id, anioNacDesde, anioNacHasta}]
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [catSelect, setCatSelect] = useState("");
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [catEditSelect, setCatEditSelect] = useState("");

  // Create form: pending category awaiting range input
  const [pendingCatId, setPendingCatId] = useState(null);
  const [pendingRangos, setPendingRangos] = useState({ anioNacDesde:"", anioNacHasta:"" });
  const [editandoChipIdx, setEditandoChipIdx] = useState(null);
  const [editandoChipRangos, setEditandoChipRangos] = useState({ anioNacDesde:"", anioNacHasta:"" });

  // Edit form: pending category
  const [pendingCatEditId, setPendingCatEditId] = useState(null);
  const [pendingRangosEdit, setPendingRangosEdit] = useState({ anioNacDesde:"", anioNacHasta:"" });
  const [editandoChipEditIdx, setEditandoChipEditIdx] = useState(null);
  const [editandoChipEditRangos, setEditandoChipEditRangos] = useState({ anioNacDesde:"", anioNacHasta:"" });

  const [isMobile, setIsMobile] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  async function cargarDatos() {
    const q = query(collection(db, "torneos_carnet"), orderBy("creadoEn", "desc"));
    const snap = await getDocs(q);
    setTorneos(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    const snapCat = await getDocs(query(collection(db, "categorias_carnet"), orderBy("nombre")));
    setCategorias(snapCat.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  function getNombreCategoria(id) {
    return categorias.find(c => c.id === id)?.nombre || id;
  }

  function getChipLabel(cat) {
    const nombre = getNombreCategoria(cat.id);
    if (cat.anioNacDesde || cat.anioNacHasta) {
      return `${nombre} (${cat.anioNacDesde||"?"}–${cat.anioNacHasta||"?"})`;
    }
    return nombre;
  }

  // --- Create form category management ---
  function agregarCategoria() {
    if (!catSelect || categoriasSeleccionadas.some(c => c.id === catSelect)) return;
    setPendingCatId(catSelect);
    setPendingRangos({ anioNacDesde:"", anioNacHasta:"" });
    setCatSelect("");
  }

  function confirmarAgregarCategoria() {
    setCategoriasSeleccionadas(prev => [...prev, { id:pendingCatId, anioNacDesde:pendingRangos.anioNacDesde, anioNacHasta:pendingRangos.anioNacHasta }]);
    setPendingCatId(null);
  }

  function quitarCategoria(id) {
    setCategoriasSeleccionadas(prev => prev.filter(c => c.id !== id));
  }

  // --- Edit form category management ---
  function agregarCategoriaEdit() {
    if (!catEditSelect || (formEdit.categorias||[]).some(c => c.id === catEditSelect)) return;
    setPendingCatEditId(catEditSelect);
    setPendingRangosEdit({ anioNacDesde:"", anioNacHasta:"" });
    setCatEditSelect("");
  }

  function confirmarAgregarCategoriaEdit() {
    setFormEdit(prev => ({ ...prev, categorias: [...(prev.categorias||[]), { id:pendingCatEditId, anioNacDesde:pendingRangosEdit.anioNacDesde, anioNacHasta:pendingRangosEdit.anioNacHasta }] }));
    setPendingCatEditId(null);
  }

  function quitarCategoriaEdit(id) {
    setFormEdit(prev => ({ ...prev, categorias: (prev.categorias||[]).filter(c => c.id !== id) }));
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
    setPendingCatId(null);
    setEditandoChipIdx(null);
    setMostrarForm(false);
    await cargarDatos();
    setLoading(false);
  }

  async function cambiarEstado(id, estado) {
    await updateDoc(doc(db, "torneos_carnet", id), { estado });
    await cargarDatos();
  }

  function iniciarEdicion(t) {
    const cats = (t.categorias || []).map(c =>
      typeof c === "string" ? { id:c, anioNacDesde:"", anioNacHasta:"" } : c
    );
    setFormEdit({ nombre:t.nombre, temporada:t.temporada||"", fechaInicioInscripcion:t.fechaInicioInscripcion, fechaCierreInscripcion:t.fechaCierreInscripcion, categorias:cats });
    setCatEditSelect("");
    setPendingCatEditId(null);
    setEditandoChipEditIdx(null);
    setEditando(t.id);
    if (isMobile) setModalEditOpen(true);
  }

  function cerrarModalEdit() {
    setModalEditOpen(false);
    setEditando(null);
    setPendingCatEditId(null);
    setEditandoChipEditIdx(null);
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
    setModalEditOpen(false);
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

  const catDisponibles = categorias.filter(c => !categoriasSeleccionadas.some(s => s.id === c.id));
  const catDisponiblesEdit = categorias.filter(c => !(formEdit.categorias||[]).some(s => s.id === c.id));

  // Shared edit form content used by both inline (desktop) and modal (mobile)
  function EditFormCategorias() {
    return (
      <div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <select style={{ ...s.input, flex:1 }} value={catEditSelect} onChange={e => setCatEditSelect(e.target.value)}>
            <option value="">— Agregar categoría —</option>
            {catDisponiblesEdit.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button style={s.btnSm("#1e3a4a")} onClick={agregarCategoriaEdit} disabled={!catEditSelect}>+</button>
        </div>

        {pendingCatEditId && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, background:"#fffdf5", border:"1px solid #e8d5a0", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#1e3a4a" }}>{getNombreCategoria(pendingCatEditId)}</span>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:12, color:"#8a9eaa", whiteSpace:"nowrap" }}>Año nac. desde:</span>
              <input type="number" style={{ ...s.inputSm, flex:1 }} value={pendingRangosEdit.anioNacDesde} onChange={e => setPendingRangosEdit({...pendingRangosEdit, anioNacDesde:e.target.value})} placeholder="2008" />
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:12, color:"#8a9eaa", whiteSpace:"nowrap" }}>hasta:</span>
              <input type="number" style={{ ...s.inputSm, flex:1 }} value={pendingRangosEdit.anioNacHasta} onChange={e => setPendingRangosEdit({...pendingRangosEdit, anioNacHasta:e.target.value})} placeholder="2010" />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...s.btnSm("#1a6e4a"), flex:1 }} onClick={confirmarAgregarCategoriaEdit}>Confirmar</button>
              <button style={{ ...s.btnSm("#8a9eaa"), flex:1 }} onClick={() => setPendingCatEditId(null)}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {(formEdit.categorias||[]).map((cat, idx) => (
            editandoChipEditIdx === idx ? (
              <span key={cat.id} style={{ display:"flex", flexDirection:"column", gap:6, background:"#fffdf5", border:"1px solid #c9a84c", borderRadius:8, padding:"10px 12px", width:"100%" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#1e3a4a" }}>{getNombreCategoria(cat.id)}</span>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#8a9eaa", whiteSpace:"nowrap" }}>Desde:</span>
                  <input type="number" style={{ ...s.inputSm, flex:1 }} value={editandoChipEditRangos.anioNacDesde} onChange={e => setEditandoChipEditRangos({...editandoChipEditRangos, anioNacDesde:e.target.value})} placeholder="desde" />
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#8a9eaa", whiteSpace:"nowrap" }}>Hasta:</span>
                  <input type="number" style={{ ...s.inputSm, flex:1 }} value={editandoChipEditRangos.anioNacHasta} onChange={e => setEditandoChipEditRangos({...editandoChipEditRangos, anioNacHasta:e.target.value})} placeholder="hasta" />
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setFormEdit(prev => ({ ...prev, categorias: prev.categorias.map((c,i) => i===idx ? {...c,...editandoChipEditRangos} : c) })); setEditandoChipEditIdx(null); }} style={{ ...s.btnSm("#1a6e4a"), flex:1 }}>✓ Guardar</button>
                  <button onClick={() => setEditandoChipEditIdx(null)} style={{ ...s.btnSm("#8a9eaa"), flex:1 }}>× Cancelar</button>
                </div>
              </span>
            ) : (
              <span key={cat.id}
                onClick={() => { setEditandoChipEditIdx(idx); setEditandoChipEditRangos({ anioNacDesde:cat.anioNacDesde, anioNacHasta:cat.anioNacHasta }); }}
                style={{ background:"#e8f5ee", border:"1px solid #1a6e4a", borderRadius:6, padding:"6px 12px", fontSize:13, color:"#1a6e4a", display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                {getChipLabel(cat)}
                <button onClick={e => { e.stopPropagation(); quitarCategoriaEdit(cat.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontWeight:700, fontSize:16, lineHeight:1 }}>×</button>
              </span>
            )
          ))}
          {(formEdit.categorias||[]).length === 0 && !pendingCatEditId && (
            <span style={{ fontSize:12, color:"#8a9eaa" }}>Ninguna categoría agregada</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>🏆 Torneos</div>
        <button style={s.btn} onClick={() => { setMostrarForm(!mostrarForm); setPendingCatId(null); setEditandoChipIdx(null); }}>+ Nuevo torneo</button>
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
              <button style={s.btn} onClick={agregarCategoria} disabled={!catSelect}>Agregar</button>
            </div>

            {pendingCatId && (
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", background:"#fffdf5", border:"1px solid #e8d5a0", borderRadius:8, padding:"8px 12px", marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#1e3a4a" }}>{getNombreCategoria(pendingCatId)}</span>
                <span style={{ fontSize:12, color:"#8a9eaa" }}>Año nac. desde:</span>
                <input type="number" style={{ ...s.inputSm, width:80 }} value={pendingRangos.anioNacDesde} onChange={e => setPendingRangos({...pendingRangos, anioNacDesde:e.target.value})} placeholder="2008" />
                <span style={{ fontSize:12, color:"#8a9eaa" }}>hasta:</span>
                <input type="number" style={{ ...s.inputSm, width:80 }} value={pendingRangos.anioNacHasta} onChange={e => setPendingRangos({...pendingRangos, anioNacHasta:e.target.value})} placeholder="2010" />
                <button style={s.btnSm("#1a6e4a")} onClick={confirmarAgregarCategoria}>Confirmar</button>
                <button style={s.btnSm("#8a9eaa")} onClick={() => setPendingCatId(null)}>Cancelar</button>
              </div>
            )}

            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {categoriasSeleccionadas.map((cat, idx) => (
                editandoChipIdx === idx ? (
                  <span key={cat.id} style={{ display:"flex", alignItems:"center", gap:4, background:"#fffdf5", border:"1px solid #c9a84c", borderRadius:6, padding:"4px 8px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"#1e3a4a" }}>{getNombreCategoria(cat.id)}:</span>
                    <input type="number" style={{ ...s.inputSm, width:70 }} value={editandoChipRangos.anioNacDesde} onChange={e => setEditandoChipRangos({...editandoChipRangos, anioNacDesde:e.target.value})} placeholder="desde" />
                    <span style={{ fontSize:11, color:"#8a9eaa" }}>–</span>
                    <input type="number" style={{ ...s.inputSm, width:70 }} value={editandoChipRangos.anioNacHasta} onChange={e => setEditandoChipRangos({...editandoChipRangos, anioNacHasta:e.target.value})} placeholder="hasta" />
                    <button onClick={() => { setCategoriasSeleccionadas(prev => prev.map((c,i) => i===idx ? {...c,...editandoChipRangos} : c)); setEditandoChipIdx(null); }} style={s.btnSm("#1a6e4a")}>✓</button>
                    <button onClick={() => setEditandoChipIdx(null)} style={s.btnSm("#8a9eaa")}>×</button>
                  </span>
                ) : (
                  <span key={cat.id}
                    onClick={() => { setEditandoChipIdx(idx); setEditandoChipRangos({ anioNacDesde:cat.anioNacDesde, anioNacHasta:cat.anioNacHasta }); }}
                    style={{ background:"#e8f5ee", border:"1px solid #1a6e4a", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#1a6e4a", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                    {getChipLabel(cat)}
                    <button onClick={e => { e.stopPropagation(); quitarCategoria(cat.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontWeight:700, fontSize:14, lineHeight:1 }}>×</button>
                  </span>
                )
              ))}
              {categoriasSeleccionadas.length === 0 && !pendingCatId && (
                <span style={{ fontSize:12, color:"#8a9eaa" }}>Ninguna categoría agregada</span>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={crearTorneo} disabled={loading}>{loading ? "Guardando..." : "Guardar torneo"}</button>
            <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={() => { setMostrarForm(false); setPendingCatId(null); setEditandoChipIdx(null); }}>Cancelar</button>
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
              <tr><td colSpan={5} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No hay torneos creados todavía.</td></tr>
            )}
            {torneos.map(t => (
              // Inline edit row: only on desktop
              !isMobile && editando === t.id ? (
                <tr key={t.id} style={{ background:"#fffdf5" }}>
                  <td style={s.td}><input style={s.inputInline} value={formEdit.nombre} onChange={e => setFormEdit({...formEdit, nombre:e.target.value})} /></td>
                  <td style={s.td}><input style={s.inputInline} value={formEdit.temporada} onChange={e => setFormEdit({...formEdit, temporada:e.target.value})} /></td>
                  <td style={s.td}>
                    <input type="date" style={{ ...s.inputInline, marginBottom:4 }} value={formEdit.fechaInicioInscripcion} onChange={e => setFormEdit({...formEdit, fechaInicioInscripcion:e.target.value})} />
                    <input type="date" style={s.inputInline} value={formEdit.fechaCierreInscripcion} onChange={e => setFormEdit({...formEdit, fechaCierreInscripcion:e.target.value})} />
                  </td>
                  <td style={{ ...s.td, minWidth:240 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                      <select style={{ ...s.inputInline, flex:1 }} value={catEditSelect} onChange={e => setCatEditSelect(e.target.value)}>
                        <option value="">— Agregar cat. —</option>
                        {catDisponiblesEdit.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <button style={s.btnSm("#1e3a4a")} onClick={agregarCategoriaEdit} disabled={!catEditSelect}>+</button>
                    </div>

                    {pendingCatEditId && (
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", background:"#fffdf5", border:"1px solid #e8d5a0", borderRadius:6, padding:"6px 8px", marginBottom:6 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:"#1e3a4a" }}>{getNombreCategoria(pendingCatEditId)}</span>
                        <input type="number" style={{ ...s.inputSm, width:65 }} value={pendingRangosEdit.anioNacDesde} onChange={e => setPendingRangosEdit({...pendingRangosEdit, anioNacDesde:e.target.value})} placeholder="desde" />
                        <span style={{ fontSize:11, color:"#8a9eaa" }}>–</span>
                        <input type="number" style={{ ...s.inputSm, width:65 }} value={pendingRangosEdit.anioNacHasta} onChange={e => setPendingRangosEdit({...pendingRangosEdit, anioNacHasta:e.target.value})} placeholder="hasta" />
                        <button style={s.btnSm("#1a6e4a")} onClick={confirmarAgregarCategoriaEdit}>✓</button>
                        <button style={s.btnSm("#8a9eaa")} onClick={() => setPendingCatEditId(null)}>×</button>
                      </div>
                    )}

                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {(formEdit.categorias||[]).map((cat, idx) => (
                        editandoChipEditIdx === idx ? (
                          <span key={cat.id} style={{ display:"flex", alignItems:"center", gap:3, background:"#fffdf5", border:"1px solid #c9a84c", borderRadius:4, padding:"3px 6px", flexWrap:"wrap" }}>
                            <span style={{ fontSize:11, fontWeight:600 }}>{getNombreCategoria(cat.id)}:</span>
                            <input type="number" style={{ ...s.inputSm, width:60 }} value={editandoChipEditRangos.anioNacDesde} onChange={e => setEditandoChipEditRangos({...editandoChipEditRangos, anioNacDesde:e.target.value})} placeholder="desde" />
                            <span style={{ fontSize:11, color:"#8a9eaa" }}>–</span>
                            <input type="number" style={{ ...s.inputSm, width:60 }} value={editandoChipEditRangos.anioNacHasta} onChange={e => setEditandoChipEditRangos({...editandoChipEditRangos, anioNacHasta:e.target.value})} placeholder="hasta" />
                            <button onClick={() => { setFormEdit(prev => ({ ...prev, categorias: prev.categorias.map((c,i) => i===idx ? {...c,...editandoChipEditRangos} : c) })); setEditandoChipEditIdx(null); }} style={s.btnSm("#1a6e4a")}>✓</button>
                            <button onClick={() => setEditandoChipEditIdx(null)} style={s.btnSm("#8a9eaa")}>×</button>
                          </span>
                        ) : (
                          <span key={cat.id}
                            onClick={() => { setEditandoChipEditIdx(idx); setEditandoChipEditRangos({ anioNacDesde:cat.anioNacDesde, anioNacHasta:cat.anioNacHasta }); }}
                            style={{ background:"#e8f5ee", border:"1px solid #1a6e4a", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#1a6e4a", display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
                            {getChipLabel(cat)}
                            <button onClick={e => { e.stopPropagation(); quitarCategoriaEdit(cat.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontWeight:700, fontSize:12, lineHeight:1 }}>×</button>
                          </span>
                        )
                      ))}
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign:"center" }}>
                    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                      <button style={s.btnSm("#1a6e4a")} onClick={() => guardarEdicion(t.id)}>Guardar</button>
                      <button style={s.btnSm("#8a9eaa")} onClick={() => { setEditando(null); setPendingCatEditId(null); setEditandoChipEditIdx(null); }}>Cancelar</button>
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

      {/* Modal de edición para mobile */}
      {modalEditOpen && editando && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModalEdit(); }}
        >
          <div style={{ background:"white", borderRadius:"16px 16px 0 0", padding:"1.5rem", width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
              <span style={{ fontWeight:700, fontSize:17, color:"#1e3a4a" }}>Editar torneo</span>
              <button onClick={cerrarModalEdit} style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#8a9eaa", lineHeight:1, padding:0 }}>×</button>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={s.label}>Nombre del torneo</label>
              <input style={s.input} value={formEdit.nombre||""} onChange={e => setFormEdit({...formEdit, nombre:e.target.value})} placeholder="Ej: Torneo Apertura 2026" />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={s.label}>Temporada</label>
              <input style={s.input} value={formEdit.temporada||""} onChange={e => setFormEdit({...formEdit, temporada:e.target.value})} placeholder="2026" />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={s.label}>Inicio inscripción</label>
              <input type="date" style={s.input} value={formEdit.fechaInicioInscripcion||""} onChange={e => setFormEdit({...formEdit, fechaInicioInscripcion:e.target.value})} />
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={s.label}>Cierre inscripción</label>
              <input type="date" style={s.input} value={formEdit.fechaCierreInscripcion||""} onChange={e => setFormEdit({...formEdit, fechaCierreInscripcion:e.target.value})} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ ...s.label, marginBottom:8 }}>Categorías</label>
              <EditFormCategorias />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...s.btn, flex:1, padding:"12px 18px", fontSize:14 }} onClick={() => guardarEdicion(editando)}>Guardar cambios</button>
              <button style={{ ...s.btn, background:"#8a9eaa", flex:1, padding:"12px 18px", fontSize:14 }} onClick={cerrarModalEdit}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
