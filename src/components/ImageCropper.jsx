import { useRef, useEffect } from "react";

const RATIOS = { dni: 85.6 / 54, carnet: 3 / 4 };

export default function ImageCropper({ imageSrc, mode, onSave, onCancel }) {
  const canvasRef  = useRef(null);
  const imgElRef   = useRef(null);          // HTMLImageElement
  const imgSize    = useRef({ w: 1, h: 1 }); // natural image dims
  const cvsSize    = useRef({ w: 0, h: 0 }); // canvas pixel dims
  const T          = useRef({ cx: 0, cy: 0, scale: 1, rot: 0 });
  const G          = useRef(null);            // active gesture state
  const rafRef     = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  function getMinScale(rot) {
    const { w: cw, h: ch } = cvsSize.current;
    const { w: iw, h: ih } = imgSize.current;
    return rot % 2 === 0
      ? Math.max(cw / iw, ch / ih)
      : Math.max(cw / ih, ch / iw);
  }

  // Keep the image covering the full canvas (no empty space).
  function clamp() {
    const { w: cw, h: ch } = cvsSize.current;
    const { w: iw, h: ih } = imgSize.current;
    const { scale, rot } = T.current;
    // After an odd number of 90° rotations, width ↔ height in canvas space.
    const [hw, hh] = rot % 2 === 0
      ? [iw * scale / 2, ih * scale / 2]
      : [ih * scale / 2, iw * scale / 2];
    T.current.cx = Math.min(hw,      Math.max(cw - hw, T.current.cx));
    T.current.cy = Math.min(hh,      Math.max(ch - hh, T.current.cy));
  }

  function draw() {
    const canvas = canvasRef.current;
    const image  = imgElRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    const { w: cw, h: ch } = cvsSize.current;
    const { w: iw, h: ih } = imgSize.current;
    const { cx, cy, scale, rot } = T.current;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }

  function redraw() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }

  // ── setup + touch events ───────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSrc) return;

    const image = new Image();

    image.onload = () => {
      const ratio = RATIOS[mode] ?? 1;
      const cw = Math.max(canvas.clientWidth, canvas.offsetWidth, 320);
      const ch = Math.round(cw / ratio);
      canvas.width  = cw;
      canvas.height = ch;
      cvsSize.current = { w: cw, h: ch };
      imgSize.current = { w: image.naturalWidth, h: image.naturalHeight };
      imgElRef.current = image;
      T.current = { cx: cw / 2, cy: ch / 2, scale: getMinScale(0), rot: 0 };
      draw();
    };
    image.src = imageSrc;

    // ── touch utilities ──

    function touchDist(a, b) {
      const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // ── handlers ──

    function onTouchStart(e) {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length === 1) {
        G.current = { type: "drag", x: ts[0].clientX, y: ts[0].clientY };
      } else if (ts.length >= 2) {
        const rect = canvas.getBoundingClientRect();
        G.current = { type: "pinch", d: touchDist(ts[0], ts[1]), rect };
      }
    }

    function onTouchMove(e) {
      e.preventDefault();
      if (!G.current) return;
      const ts = e.touches;
      const t  = T.current;

      if (G.current.type === "drag" && ts.length >= 1) {
        t.cx += ts[0].clientX - G.current.x;
        t.cy += ts[0].clientY - G.current.y;
        G.current.x = ts[0].clientX;
        G.current.y = ts[0].clientY;
        clamp();
        redraw();

      } else if (G.current.type === "pinch" && ts.length >= 2) {
        const newD = touchDist(ts[0], ts[1]);
        if (G.current.d === 0) { G.current.d = newD; return; }

        // Zoom toward the pinch midpoint so the area under the fingers stays fixed.
        const { rect } = G.current;
        const px = (ts[0].clientX + ts[1].clientX) / 2 - rect.left;
        const py = (ts[0].clientY + ts[1].clientY) / 2 - rect.top;

        const rawScale = t.scale * (newD / G.current.d);
        const minS     = getMinScale(t.rot);
        const newScale = Math.max(minS, Math.min(5, rawScale));
        const ratio    = newScale / t.scale;

        t.cx    = px + (t.cx - px) * ratio;
        t.cy    = py + (t.cy - py) * ratio;
        t.scale = newScale;
        G.current.d = newD;
        clamp();
        redraw();
      }
    }

    function onTouchEnd(e) {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length === 0) {
        G.current = null;
      } else if (ts.length === 1) {
        G.current = { type: "drag", x: ts[0].clientX, y: ts[0].clientY };
      } else {
        const rect = canvas.getBoundingClientRect();
        G.current = { type: "pinch", d: touchDist(ts[0], ts[1]), rect };
      }
    }

    const opts = { passive: false };
    canvas.addEventListener("touchstart",  onTouchStart,  opts);
    canvas.addEventListener("touchmove",   onTouchMove,   opts);
    canvas.addEventListener("touchend",    onTouchEnd,    opts);
    canvas.addEventListener("touchcancel", onTouchEnd,    opts);

    return () => {
      canvas.removeEventListener("touchstart",  onTouchStart);
      canvas.removeEventListener("touchmove",   onTouchMove);
      canvas.removeEventListener("touchend",    onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [imageSrc, mode]);

  // ── button handlers ────────────────────────────────────────────────────────

  function handleRotate() {
    const newRot = (T.current.rot + 1) % 4;
    T.current.rot   = newRot;
    T.current.scale = Math.max(T.current.scale, getMinScale(newRot));
    const { w: cw, h: ch } = cvsSize.current;
    T.current.cx = cw / 2;
    T.current.cy = ch / 2;
    clamp();
    redraw();
  }

  function handleSave() {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL("image/jpeg", 0.92));
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const cssRatio = mode === "carnet" ? "3/4" : `${85.6}/${54}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ border: "2px solid red", lineHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", display: "block", touchAction: "none", aspectRatio: cssRatio }}
        />
      </div>

      <p style={{ fontSize: 12, color: "#4a6070", textAlign: "center", margin: 0 }}>
        Posicioná la imagen dentro del recuadro. Podés moverla y hacer zoom con los dedos.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleRotate}
          style={{
            background: "#1e3a4a", color: "white", border: "none",
            borderRadius: 12, width: 52, height: 52, fontSize: 22,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >↻</button>
        <button
          onClick={handleSave}
          style={{
            background: "#1e3a4a", color: "white", border: "none",
            borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600,
            cursor: "pointer", flex: 1,
          }}
        >Guardar</button>
      </div>
    </div>
  );
}
