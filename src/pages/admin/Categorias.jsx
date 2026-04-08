import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, orderBy, query } from "firebase/firestore";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer" }),
  input: { width:"100%", padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" },
  label: { fontSize:11, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:4 },
  card: { background:"white", borderRadius:12, padding:"1.25rem 1.5rem", border:"1px solid #ede5d5", marginBottom:"1rem" },
  th: { padding:"10px 14px", fontSize:11, fontWeight:600, color:"#8a9eaa", textTransform:"uppercase", letterSpacing:"0.6px", textAlign:"left", borderBottom:"1px solid #ede5d5", whiteSpace:"nowrap" },
  td: { padding:"12px 14px", fontSize:13, color:"#1e3a4a", borderBottom:"1px solid #f5f0e8", verticalAlign:"middle" },
  inputInline: { padding:"6px 10px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", width:"100%" },
};

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre:"", anioNacDesde:"", anioNacHasta:"" });
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargarCategorias(); }, []);

  async function cargarCategorias() {
    const snap = await getDocs(query(collection(db, "categorias_carnet"), orderBy("nombre")));
    setCategorias(snap.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  async function crearCategoria() {
    if (!form.nombre) return;
    setLoading(true);
    await addDoc(collection(db, "categorias_carnet"), {
      nombre: form.nombre,
      anioNacDesde: form.anioNacDesde || "",
      anioNacHasta: form.anioNacHasta || "",
    });
    setForm({ nombre:"", anioNacDesde:"", anioNacHasta:"" });
    setMostrarForm(false);
    await cargarCategorias();
    setLoading(false);
  }

  function iniciarEdicion(c) {
    setEditando(c.id);
    setFormEdit({ nombre:c.nombre, anioNacDesde:c.anioNacDesde||"", anioNacHasta:c.anioNacHasta||"" });
  }

  async function guardarEdicion(id) {
    await updateDoc(doc(db, "categorias_carnet", id), {
      nombre: formEdit.nombre,
      anioNacDesde: formEdit.anioNacDesde || "",
      anioNacHasta: formEdit.anioNacHasta || "",
    });
    setEditando(null);
    await cargarCategorias();
  }

  async function eliminarCategoria(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await deleteDoc(doc(db, "categorias_carnet", id));
    await cargarCategorias();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>📋 Categorías</div>
        <button style={s.btn} onClick={() => setMostrarForm(!mostrarForm)}>+ Nueva categoría</button>
      </div>

      {mostrarForm && (
        <div style={s.card}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={s.label}>Nombre</label>
              <input style={s.input} value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} placeholder="Ej: Sub-13, Primera, Adultos" />
            </div>
            <div>
              <label style={s.label}>Año nac. desde</label>
              <input type="number" style={s.input} value={form.anioNacDesde} onChange={e => setForm({...form, anioNacDesde:e.target.value})} placeholder="Ej: 2011" />
            </div>
            <div>
              <label style={s.label}>Año nac. hasta</label>
              <input type="number" style={s.input} value={form.anioNacHasta} onChange={e => setForm({...form, anioNacHasta:e.target.value})} placeholder="Ej: 2013" />
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={s.btn} onClick={crearCategoria} disabled={loading}>{loading ? "Guardando..." : "Guardar"}</button>
            <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f5f0e8" }}>
            <tr>
              <th style={s.th}>Categoría</th>
              <th style={s.th}>Año nac. desde</th>
              <th style={s.th}>Año nac. hasta</th>
              <th style={{ ...s.th, textAlign:"center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 && (
              <tr><td colSpan={4} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No hay categorías creadas todavía.</td></tr>
            )}
            {categorias.map(c => (
              <tr key={c.id}>
                {editando === c.id ? (
                  <>
                    <td style={s.td}><input style={s.inputInline} value={formEdit.nombre} onChange={e => setFormEdit({...formEdit, nombre:e.target.value})} /></td>
                    <td style={s.td}><input type="number" style={s.inputInline} value={formEdit.anioNacDesde} onChange={e => setFormEdit({...formEdit, anioNacDesde:e.target.value})} placeholder="Ej: 2011" /></td>
                    <td style={s.td}><input type="number" style={s.inputInline} value={formEdit.anioNacHasta} onChange={e => setFormEdit({...formEdit, anioNacHasta:e.target.value})} placeholder="Ej: 2013" /></td>
                    <td style={{ ...s.td, textAlign:"center" }}>
                      <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                        <button style={s.btnSm("#1a6e4a")} onClick={() => guardarEdicion(c.id)}>Guardar</button>
                        <button style={s.btnSm("#8a9eaa")} onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ ...s.td, fontWeight:600 }}>{c.nombre}</td>
                    <td style={s.td}>{c.anioNacDesde || "—"}</td>
                    <td style={s.td}>{c.anioNacHasta || "—"}</td>
                    <td style={{ ...s.td, textAlign:"center" }}>
                      <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
                        <button style={s.btnSm("#c9a84c")} onClick={() => iniciarEdicion(c)}>Editar</button>
                        <button style={s.btnSm("#c0392b")} onClick={() => eliminarCategoria(c.id)}>Eliminar</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
