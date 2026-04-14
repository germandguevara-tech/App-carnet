import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function Verificador({ onVolver }) {
  const [escaneando, setEscaneando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [camarasDisponibles, setCamarasDisponibles] = useState([]);
  const [camaraSeleccionada, setCamaraSeleccionada] = useState("");
  const videoRef = useRef(null);
  const codeReader = useRef(null);

  useEffect(() => {
    cargarCamaras();
    return () => { codeReader.current?.reset(); };
  }, []);

  async function cargarCamaras() {
    try {
      const reader = new BrowserMultiFormatReader();
      const devices = await reader.listVideoInputDevices();
      setCamarasDisponibles(devices);
      if (devices.length > 0) {
        const trasera = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("trasera") || d.label.toLowerCase().includes("rear"));
        setCamaraSeleccionada(trasera?.deviceId || devices[devices.length - 1].deviceId);
      }
    } catch(e) {
      setError("No se pudo acceder a las cámaras: " + e.message);
    }
  }

  async function iniciarEscaneo() {
    setError("");
    setResultado(null);
    setEscaneando(true);
    codeReader.current = new BrowserMultiFormatReader();
    try {
      const constraints = camaraSeleccionada
        ? { deviceId: { exact: camaraSeleccionada } }
        : { facingMode: "environment" };

      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      codeReader.current.decodeFromStream(stream, videoRef.current, (result, err) => {
        if (result) {
          const texto = result.getText();
          console.log("QR leído:", texto);
          if (texto.includes("/verificar/")) {
            const id = texto.split("/verificar/")[1].split("?")[0].trim();
            stream.getTracks().forEach(t => t.stop());
            codeReader.current?.reset();
            setEscaneando(false);
            setResultado(id);
          }
        }
      });
    } catch(e) {
      setError("Error al acceder a la cámara: " + e.message);
      setEscaneando(false);
    }
  }

  function detener() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    codeReader.current?.reset();
    setEscaneando(false);
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem" }}>
        <button onClick={() => { detener(); onVolver(); }} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#1e3a4a" }}>←</button>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>Verificar jugador</div>
      </div>

      {!escaneando && !resultado && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
            📷 Escaneá el QR del carnet digital del jugador rival para verificar su identidad.
          </div>
          {camarasDisponibles.length > 1 && (
            <div>
              <label style={{ fontSize:12, color:"#4a6070", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", display:"block", marginBottom:6 }}>Cámara</label>
              <select
                style={{ width:"100%", padding:"10px 12px", border:"1.5px solid #ede5d5", borderRadius:10, fontSize:13, outline:"none", background:"white" }}
                value={camaraSeleccionada}
                onChange={e => setCamaraSeleccionada(e.target.value)}
              >
                {camarasDisponibles.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Cámara " + d.deviceId.slice(0,8)}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={iniciarEscaneo}
            style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer" }}
          >
            📷 Escanear QR
          </button>
          {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
        </div>
      )}

      {escaneando && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ position:"relative", borderRadius:14, overflow:"hidden", background:"#000", minHeight:300 }}>
            <video ref={videoRef} style={{ width:"100%", display:"block" }} autoPlay playsInline muted />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:200, height:200, position:"relative" }}>
                <div style={{ position:"absolute", top:0, left:0, width:24, height:24, borderTop:"3px solid #c9a84c", borderLeft:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", top:0, right:0, width:24, height:24, borderTop:"3px solid #c9a84c", borderRight:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", bottom:0, left:0, width:24, height:24, borderBottom:"3px solid #c9a84c", borderLeft:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderBottom:"3px solid #c9a84c", borderRight:"3px solid #c9a84c" }} />
              </div>
            </div>
            <div style={{ position:"absolute", bottom:12, left:0, right:0, textAlign:"center", color:"rgba(255,255,255,0.7)", fontSize:13 }}>
              Apuntá al código QR del carnet
            </div>
          </div>
          <button onClick={detener} style={{ width:"100%", background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Cancelar
          </button>
          {error && <div style={{ color:"#c0392b", fontSize:13 }}>{error}</div>}
        </div>
      )}

      {resultado && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"#e8f5ee", border:"1.5px solid #1a6e4a", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#1a6e4a" }}>
            ✓ QR leído correctamente.
          </div>
          <iframe
            src={`/verificar/${resultado}`}
            style={{ width:"100%", height:"600px", border:"none", borderRadius:14 }}
            title="Carnet verificado"
          />
          <button onClick={() => setResultado(null)} style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Escanear otro
          </button>
        </div>
      )}
    </div>
  );
}
