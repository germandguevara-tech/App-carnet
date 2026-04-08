import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function Verificador({ onVolver }) {
  const [escaneando, setEscaneando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const codeReader = useRef(null);

  useEffect(() => {
    return () => { codeReader.current?.reset(); };
  }, []);

  async function iniciarEscaneo() {
    setError("");
    setResultado(null);
    setEscaneando(true);
    codeReader.current = new BrowserMultiFormatReader();
    try {
      await codeReader.current.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          const texto = result.getText();
          console.log("QR leído:", texto);
          if (texto.includes("/verificar/")) {
            const id = texto.split("/verificar/")[1];
            codeReader.current?.reset();
            setEscaneando(false);
            setResultado(id);
          }
        }
      });
    } catch(e) {
      setError("No se pudo acceder a la cámara");
      setEscaneando(false);
    }
  }

  function detener() {
    codeReader.current?.reset();
    setEscaneando(false);
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem" }}>
        <button onClick={onVolver} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#1e3a4a" }}>←</button>
        <div style={{ fontSize:18, fontWeight:600, color:"#1e3a4a" }}>Verificar jugador</div>
      </div>

      {!escaneando && !resultado && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#7a5c00" }}>
            📷 Escaneá el QR del carnet digital del jugador rival para verificar su identidad.
          </div>
          <button
            onClick={iniciarEscaneo}
            style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"14px", fontSize:15, fontWeight:600, cursor:"pointer" }}
          >
            📷 Escanear QR
          </button>
        </div>
      )}

      {escaneando && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ position:"relative", borderRadius:14, overflow:"hidden", background:"#1a1a2e" }}>
            <video ref={videoRef} style={{ width:"100%", borderRadius:14 }} autoPlay />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:200, height:200, border:"2px solid #c9a84c", borderRadius:8 }}>
                <div style={{ position:"absolute", top:0, left:0, width:20, height:20, borderTop:"3px solid #c9a84c", borderLeft:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", top:0, right:0, width:20, height:20, borderTop:"3px solid #c9a84c", borderRight:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", bottom:0, left:0, width:20, height:20, borderBottom:"3px solid #c9a84c", borderLeft:"3px solid #c9a84c" }} />
                <div style={{ position:"absolute", bottom:0, right:0, width:20, height:20, borderBottom:"3px solid #c9a84c", borderRight:"3px solid #c9a84c" }} />
              </div>
            </div>
            <div style={{ position:"absolute", bottom:16, left:0, right:0, textAlign:"center", color:"rgba(255,255,255,0.7)", fontSize:13 }}>
              Apuntá al código QR del carnet
            </div>
          </div>
          <button onClick={detener} style={{ width:"100%", background:"#8a9eaa", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Cancelar
          </button>
        </div>
      )}

      {resultado && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"#e8f5ee", border:"1.5px solid #1a6e4a", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#1a6e4a" }}>
            ✓ QR leído correctamente. Mostrando carnet...
          </div>
          <iframe
            src={`/verificar/${resultado}`}
            style={{ width:"100%", height:"600px", border:"none", borderRadius:14 }}
            title="Carnet verificado"
          />
          <button
            onClick={() => { setResultado(null); }}
            style={{ width:"100%", background:"#1e3a4a", color:"white", border:"none", borderRadius:12, padding:"12px", fontSize:14, fontWeight:600, cursor:"pointer" }}
          >
            Escanear otro
          </button>
        </div>
      )}

      {error && <div style={{ color:"#c0392b", fontSize:13, marginTop:"1rem" }}>{error}</div>}
    </div>
  );
}
