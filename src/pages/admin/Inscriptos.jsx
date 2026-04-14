import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { urlVisualizacion } from "../../utils/drive";
import { descargarExcel } from "../../utils/excel";

const s = {
  titulo: { fontSize:22, fontWeight:600, color:"#1e3a4a", margin:0 },
  th: { padding:"10px 14px", fontSize:11, fontWeight:600, color:"#8a9eaa", textTransform:"uppercase", letterSpacing:"0.6px", textAlign:"left", borderBottom:"1px solid #ede5d5", whiteSpace:"nowrap" },
  td: { padding:"10px 14px", fontSize:13, color:"#1e3a4a", borderBottom:"1px solid #f5f0e8", verticalAlign:"middle", cursor:"pointer" },
  select: { padding:"9px 12px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", background:"white" },
  btn: { background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer" },
  btnSm: (color) => ({ background:color, color:"white", border:"none", borderRadius:6, padding:"5px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }),
};

const ESTADO_COLORES = { pendiente:"#c9a84c", habilitado:"#1a6e4a", rechazado:"#c0392b", baja_solicitada:"#8a9eaa", inactivo:"#444" };
const ESTADO_BG = { pendiente:"#fff8e1", habilitado:"#e8f5ee", rechazado:"#fdecea", baja_solicitada:"#f5f0e8", inactivo:"#f0f0f0" };

const MOTIVOS_RECHAZO = [
  "Foto carnet no coincide con el documento",
  "Foto del DNI borrosa o ilegible",
  "Datos no coinciden con el documento",
  "Foto carnet de cuerpo entero (debe ser busto)",
  "Fondo de foto carnet inadecuado",
  "Otro motivo"
];

export default function Inscriptos() {
  const [jugadores, setJugadores] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [torneoFiltro, setTorneoFiltro] = useState("");
  const [clubFiltro, setClubFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("pendiente");
  const [loading, setLoading] = useState(false);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState(MOTIVOS_RECHAZO[0]);
  const [editando, setEditando] = useState(false);
  const [datosEdit, setDatosEdit] = useState({});
  const [duplicados, setDuplicados] = useState([]);
  const [orden, setOrden] = useState("desc");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);

  useEffect(() => { cargarFiltros(); }, []);
  useEffect(() => { if(torneoFiltro) cargarJugadores(); }, [torneoFiltro, clubFiltro, estadoFiltro, orden, categoriaFiltro]);
  useEffect(() => { setSeleccionados([]); }, [torneoFiltro, clubFiltro, estadoFiltro, categoriaFiltro]);

  async function cargarFiltros() {
    const snapT = await getDocs(collection(db, "torneos_carnet"));
    const listaTorneos = snapT.docs.map(d => ({ id:d.id, ...d.data() }));
    setTorneos(listaTorneos);
    const activo = listaTorneos.find(t => t.estado === "activo");
    if (activo) setTorneoFiltro(activo.id);
    const snapC = await getDocs(collection(db, "clubes_carnet"));
    setClubes(snapC.docs.map(d => ({ id:d.id, ...d.data() })));
  }

  async function cargarJugadores() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), orderBy("creadoEn", "desc")));
    let lista = snap.docs.map(d => ({ id:d.id, ...d.data() }));

    let listaTorneo = lista.filter(j => j.torneoId === torneoFiltro);
    const cats = [...new Set(listaTorneo.map(j => j.categoria).filter(Boolean))].sort();
    setCategorias(cats);

    const dniCount = {};
    lista.forEach(j => {
      if (j.torneoId === torneoFiltro) {
        dniCount[j.dni] = (dniCount[j.dni] || []);
        dniCount[j.dni].push(j.clubId);
      }
    });
    const dnisDuplicados = Object.keys(dniCount).filter(dni => new Set(dniCount[dni]).size > 1);
    setDuplicados(dnisDuplicados);

    if (torneoFiltro) lista = lista.filter(j => j.torneoId === torneoFiltro);
    if (clubFiltro) lista = lista.filter(j => j.clubId === clubFiltro);
    if (estadoFiltro) lista = lista.filter(j => j.estado === estadoFiltro);
    if (categoriaFiltro) lista = lista.filter(j => j.categoria === categoriaFiltro);
    lista = lista.sort((a, b) => {
      const fechaA = a.creadoEn?.toDate ? a.creadoEn.toDate() : new Date(a.creadoEn || 0);
      const fechaB = b.creadoEn?.toDate ? b.creadoEn.toDate() : new Date(b.creadoEn || 0);
      return orden === "desc" ? fechaB - fechaA : fechaA - fechaB;
    });
    setJugadores(lista);
    setLoading(false);
  }

  async function cambiarEstado(id, estado, motivo="") {
    await updateDoc(doc(db, "jugadores_carnet", id), { estado, motivoRechazo: motivo, revisadoEn: new Date() });
    await cargarJugadores();
    if (jugadorSeleccionado?.id === id) {
      setJugadorSeleccionado(prev => ({ ...prev, estado, motivoRechazo: motivo }));
    }
  }

  function getNombreClub(uid) {
    return clubes.find(c => c.uid === uid)?.nombre || "—";
  }

  async function guardarEdicion() {
    await updateDoc(doc(db, "jugadores_carnet", jugadorSeleccionado.id), {
      apellido: datosEdit.apellido,
      nombre: datosEdit.nombre,
      dni: datosEdit.dni,
      fechaNacimiento: datosEdit.fechaNacimiento,
      categoria: datosEdit.categoria,
    });
    setEditando(false);
    setJugadorSeleccionado(prev => ({ ...prev, ...datosEdit }));
    await cargarJugadores();
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function seleccionarTodos() {
    if (seleccionados.length === jugadores.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(jugadores.map(j => j.id));
    }
  }

  async function handleDescargarExcel() {
    const configSnap = await getDoc(doc(db, "config_carnet", "general"));
    const rutaBase = configSnap.exists() ? configSnap.data().rutaBase : "";
    const snap = await getDocs(query(collection(db, "jugadores_carnet"), orderBy("creadoEn", "desc")));
    let lista = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if (torneoFiltro) lista = lista.filter(j => j.torneoId === torneoFiltro);
    if (clubFiltro) lista = lista.filter(j => j.clubId === clubFiltro);
    if (estadoFiltro) lista = lista.filter(j => j.estado === estadoFiltro);
    if (categoriaFiltro) lista = lista.filter(j => j.categoria === categoriaFiltro);
    if (seleccionados.length > 0) lista = lista.filter(j => seleccionados.includes(j.id));
    const listaConNombres = lista.map(j => {
      const clubNombre = clubes.find(c => c.uid === j.clubId)?.nombre || "";
      const torneoNombre = torneos.find(t => t.id === j.torneoId)?.nombre || "";
      const rutaCarnet = rutaBase ? `${rutaBase}\\${torneoNombre}\\${clubNombre}\\${j.categoria}-${j.apellido} ${j.nombre}.jpg` : "";
      const rutaDniFrente = rutaBase ? `${rutaBase}\\${torneoNombre}\\${clubNombre}\\DNI-F-${j.apellido} ${j.nombre}-${j.dni}.jpg` : "";
      const rutaDniDorso = rutaBase ? `${rutaBase}\\${torneoNombre}\\${clubNombre}\\DNI-D-${j.apellido} ${j.nombre}-${j.dni}.jpg` : "";
      return { ...j, clubNombre, torneoNombre, rutaCarnet, rutaDniFrente, rutaDniDorso };
    });
    const torneoNombre = torneos.find(t => t.id === torneoFiltro)?.nombre || "todos";
    descargarExcel(listaConNombres, `Inscriptos-${torneoNombre}`);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div style={s.titulo}>👥 Inscriptos</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {seleccionados.length > 0 && (
            <span style={{ fontSize:13, color:"#8a9eaa" }}>{seleccionados.length} seleccionado{seleccionados.length > 1 ? "s" : ""}</span>
          )}
          <button style={{ ...s.btn, background:"#8a9eaa" }} onClick={seleccionarTodos}>
            {seleccionados.length === jugadores.length && jugadores.length > 0 ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
          <button style={{ ...s.btn, background:"#1a6e4a" }} onClick={handleDescargarExcel}>
            📥 {seleccionados.length > 0 ? `Descargar (${seleccionados.length})` : "Descargar Excel"}
          </button>
        </div>
      </div>

      {duplicados.length > 0 && (
        <div style={{ background:"#fdecea", border:"1.5px solid #c0392b", borderRadius:10, padding:"10px 16px", marginBottom:"1rem", fontSize:13, color:"#c0392b" }}>
          ⚠️ {duplicados.length} jugador{duplicados.length > 1 ? "es" : ""} inscripto{duplicados.length > 1 ? "s" : ""} en más de un club: DNI {duplicados.join(", ")}
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
        <select style={{ ...s.select, flex:2, minWidth:160 }} value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}>
          {torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select style={{ ...s.select, flex:1, minWidth:120 }} value={clubFiltro} onChange={e => setClubFiltro(e.target.value)}>
          <option value="">Todos los clubes</option>
          {clubes.map(c => <option key={c.id} value={c.uid}>{c.nombre}</option>)}
        </select>
        <select style={{ ...s.select, flex:1, minWidth:110 }} value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="habilitado">Habilitado</option>
          <option value="rechazado">Rechazado</option>
          <option value="baja_solicitada">Baja solicitada</option>
          <option value="inactivo">Inactivo</option>
          <option value="reactivacion_solicitada">Reactivación</option>
        </select>
        <select style={{ ...s.select, flex:1, minWidth:110 }} value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
          <option value="">Todas las cat.</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...s.select, flex:1, minWidth:130 }} value={orden} onChange={e => setOrden(e.target.value)}>
          <option value="desc">Más recientes</option>
          <option value="asc">Más antiguos</option>
        </select>
      </div>

      <div style={{ background:"white", borderRadius:12, border:"1px solid #ede5d5", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:"#f5f0e8" }}>
            <tr>
              <th style={{ ...s.th, width:40, textAlign:"center" }}>
                <input type="checkbox" checked={seleccionados.length === jugadores.length && jugadores.length > 0} onChange={seleccionarTodos} />
              </th>
              <th style={s.th}>Foto</th>
              <th style={s.th}>Apellido y nombre</th>
              <th style={s.th}>DNI</th>
              <th style={s.th}>Fecha nac.</th>
              <th style={s.th}>Categoría</th>
              <th style={s.th}>Club</th>
              <th style={{ ...s.th, textAlign:"center" }}>Estado</th>
              <th style={{ ...s.th, textAlign:"center" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>Cargando...</td></tr>}
            {!loading && jugadores.length === 0 && <tr><td colSpan={9} style={{ ...s.td, textAlign:"center", color:"#8a9eaa", padding:"2rem" }}>No hay jugadores.</td></tr>}
            {jugadores.map(j => (
              <tr key={j.id} onClick={() => setJugadorSeleccionado(j)} style={{ cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.background="#f9f7f4"}
                onMouseLeave={e => e.currentTarget.style.background="white"}>
                <td style={{ ...s.td, textAlign:"center" }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={seleccionados.includes(j.id)} onChange={() => toggleSeleccion(j.id)} />
                </td>
                <td style={s.td}>
                  <div style={{ width:32, height:43, borderRadius:4, overflow:"hidden", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {j.fotoCarnetUrl ? <img src={urlVisualizacion(j.fotoCarnetUrl)} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:14 }}>👤</span>}
                  </div>
                </td>
                <td style={{ ...s.td, fontWeight:600 }}>
                  {duplicados.includes(j.dni) && <span style={{ color:"#c0392b", marginRight:4 }}>⚠️</span>}
                  {j.apellido}, {j.nombre}
                </td>
                <td style={s.td}>{j.dni}</td>
                <td style={s.td}>{j.fechaNacimiento ? j.fechaNacimiento.split("-").reverse().join("/") : "—"}</td>
                <td style={s.td}>{j.categoria}</td>
                <td style={s.td}>{getNombreClub(j.clubId)}</td>
                <td style={{ ...s.td, textAlign:"center" }}>
                  <span style={{ background: ESTADO_BG[j.estado], color: ESTADO_COLORES[j.estado], borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:600 }}>
                    {j.estado}
                  </span>
                </td>
                <td style={{ ...s.td, fontSize:11, color:"#8a9eaa", textAlign:"center" }}>
                  {j.creadoEn?.toDate ? j.creadoEn.toDate().toLocaleDateString("es-AR") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {jugadorSeleccionado && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}>
          <div style={{ background:"white", borderRadius:16, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 1.5rem", borderBottom:"1px solid #ede5d5" }}>
              <div style={{ fontSize:16, fontWeight:600, color:"#1e3a4a" }}>{jugadorSeleccionado.apellido}, {jugadorSeleccionado.nombre}</div>
              <button onClick={() => setJugadorSeleccionado(null)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#8a9eaa" }}>×</button>
            </div>

            <div style={{ padding:"1.5rem" }}>
              <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:"1rem" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:11, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase" }}>Foto carnet</div>
                  <div style={{ width:120, height:160, borderRadius:8, overflow:"hidden", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #ede5d5" }}>
                    {jugadorSeleccionado.fotoCarnetUrl ? (
                      <img src={urlVisualizacion(jugadorSeleccionado.fotoCarnetUrl)} style={{ width:"100%", height:"100%", objectFit:"cover", imageOrientation:"from-image" }} />
                    ) : <span style={{ fontSize:32 }}>👤</span>}
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:11, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase" }}>Foto DNI frente</div>
                  <div style={{ width:200, height:130, borderRadius:8, overflow:"hidden", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #ede5d5" }}>
                    {jugadorSeleccionado.fotoDniFrente ? (
                      <img src={urlVisualizacion(jugadorSeleccionado.fotoDniFrente)} style={{ width:"100%", height:"100%", objectFit:"contain", imageOrientation:"from-image" }} />
                    ) : <span style={{ fontSize:24, color:"#8a9eaa" }}>Sin foto</span>}
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ fontSize:11, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase" }}>Foto DNI dorso</div>
                  <div style={{ width:200, height:130, borderRadius:8, overflow:"hidden", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #ede5d5" }}>
                    {jugadorSeleccionado.fotoDniDorso ? (
                      <img src={urlVisualizacion(jugadorSeleccionado.fotoDniDorso)} style={{ width:"100%", height:"100%", objectFit:"contain", imageOrientation:"from-image" }} />
                    ) : <span style={{ fontSize:24, color:"#8a9eaa" }}>Sin foto</span>}
                  </div>
                </div>
              </div>

              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase" }}>Datos</div>
                  <button onClick={() => { setEditando(!editando); setDatosEdit({ apellido:jugadorSeleccionado.apellido, nombre:jugadorSeleccionado.nombre, dni:jugadorSeleccionado.dni, fechaNacimiento:jugadorSeleccionado.fechaNacimiento, categoria:jugadorSeleccionado.categoria }); }}
                    style={{ background:"none", border:"1px solid #c9a84c", borderRadius:6, padding:"3px 10px", fontSize:11, color:"#c9a84c", cursor:"pointer" }}>
                    {editando ? "Cancelar" : "✏️ Editar"}
                  </button>
                </div>
                {!editando ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { label:"Apellido", val:jugadorSeleccionado.apellido },
                      { label:"Nombre", val:jugadorSeleccionado.nombre },
                      { label:"DNI", val:jugadorSeleccionado.dni },
                      { label:"Fecha nac.", val: jugadorSeleccionado.fechaNacimiento ? jugadorSeleccionado.fechaNacimiento.split("-").reverse().join("/") : "—" },
                      { label:"Categoría", val:jugadorSeleccionado.categoria },
                      { label:"Club", val:getNombreClub(jugadorSeleccionado.clubId) },
                      { label:"Inscripto", val: jugadorSeleccionado.creadoEn?.toDate ? jugadorSeleccionado.creadoEn.toDate().toLocaleDateString("es-AR") : "—" },
                    ].map(d => (
                      <div key={d.label} style={{ display:"flex", gap:8, fontSize:13 }}>
                        <span style={{ color:"#8a9eaa", width:80 }}>{d.label}</span>
                        <span style={{ fontWeight:600, color:"#1e3a4a" }}>{d.val}</span>
                      </div>
                    ))}
                    {jugadorSeleccionado.motivoRechazo && (
                      <div style={{ background:"#fdecea", borderRadius:6, padding:"6px 10px", fontSize:12, color:"#c0392b", marginTop:4 }}>
                        Motivo rechazo: {jugadorSeleccionado.motivoRechazo}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { label:"Apellido", key:"apellido" },
                      { label:"Nombre", key:"nombre" },
                      { label:"DNI", key:"dni" },
                    ].map(d => (
                      <div key={d.key}>
                        <label style={{ fontSize:11, color:"#8a9eaa", display:"block", marginBottom:2 }}>{d.label}</label>
                        <input style={{ width:"100%", padding:"7px 10px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                          value={datosEdit[d.key] || ""} onChange={e => setDatosEdit({...datosEdit, [d.key]: e.target.value})} />
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize:11, color:"#8a9eaa", display:"block", marginBottom:2 }}>Fecha nac.</label>
                      <input type="date" style={{ width:"100%", padding:"7px 10px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
                        value={datosEdit.fechaNacimiento || ""} onChange={e => setDatosEdit({...datosEdit, fechaNacimiento: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:"#8a9eaa", display:"block", marginBottom:2 }}>Categoría</label>
                      <select style={{ width:"100%", padding:"7px 10px", border:"1.5px solid #ede5d5", borderRadius:8, fontSize:13, outline:"none", background:"white" }}
                        value={datosEdit.categoria || ""} onChange={e => setDatosEdit({...datosEdit, categoria: e.target.value})}>
                        <option value="">— Seleccioná —</option>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={guardarEdicion} style={{ background:"#1e3a4a", color:"white", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      Guardar cambios
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #ede5d5" }}>
              <div style={{ fontSize:12, color:"#8a9eaa", fontWeight:600, textTransform:"uppercase", marginBottom:10 }}>Cambiar estado</div>

              {jugadorSeleccionado.estado === "pendiente" && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "habilitado")}>✓ Habilitar</button>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flex:1 }}>
                    <select style={{ ...s.select, flex:1, fontSize:12, padding:"5px 8px" }} value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}>
                      {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button style={s.btnSm("#c0392b")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "rechazado", motivoRechazo)}>✕ Rechazar</button>
                  </div>
                </div>
              )}
              {jugadorSeleccionado.estado === "habilitado" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button style={s.btnSm("#c9a84c")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "pendiente")}>Volver a pendiente</button>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flex:1 }}>
                    <select style={{ ...s.select, flex:1, fontSize:12, padding:"5px 8px" }} value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}>
                      {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button style={s.btnSm("#c0392b")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "rechazado", motivoRechazo)}>✕ Rechazar</button>
                  </div>
                </div>
              )}
              {jugadorSeleccionado.estado === "rechazado" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "habilitado")}>✓ Habilitar</button>
                  <button style={s.btnSm("#c9a84c")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "pendiente")}>Volver a pendiente</button>
                </div>
              )}
              {jugadorSeleccionado.estado === "baja_solicitada" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "habilitado")}>Denegar baja</button>
                  <button style={s.btnSm("#8a9eaa")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "inactivo")}>Confirmar baja</button>
                </div>
              )}
              {jugadorSeleccionado.estado === "inactivo" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "habilitado")}>✓ Reactivar</button>
                  <button style={s.btnSm("#c9a84c")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "pendiente")}>Volver a pendiente</button>
                </div>
              )}
              {jugadorSeleccionado.estado === "reactivacion_solicitada" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button style={s.btnSm("#1a6e4a")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "habilitado")}>✓ Aprobar reactivación</button>
                  <button style={s.btnSm("#c0392b")} onClick={() => cambiarEstado(jugadorSeleccionado.id, "inactivo")}>✕ Rechazar reactivación</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
