// composants/PointageService.jsx — fenêtre de pointage : l'agent en service doit confirmer sa présence (lutte contre le farm).
import React, { useEffect, useState } from "react";

export function PointageService({ limite, onConfirm }) {
  const [reste, setReste] = useState(() => Math.max(0, limite - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setReste(Math.max(0, limite - Date.now())), 500);
    const titre = document.title;
    let on = true;
    const clign = setInterval(() => { document.title = on ? "⏰ Pointage de service !" : titre; on = !on; }, 1000);
    return () => { clearInterval(t); clearInterval(clign); document.title = titre; };
  }, [limite]);
  const sec = Math.ceil(reste / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const part = Math.min(100, Math.max(0, (reste / (4 * 60000)) * 100));
  return (
    <div role="alertdialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(7,20,46,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="gn-appear" style={{ width: "100%", maxWidth: 420, background: "#F7FAFD", borderRadius: 22, overflow: "hidden", textAlign: "center", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.9)" }}>
        <div style={{ display: "flex", height: 6 }}><div style={{ flex: 1, background: "#0B3A8F" }} /><div style={{ flex: 1, background: "#fff" }} /><div style={{ flex: 1, background: "#C0172D" }} /></div>
        <div style={{ padding: "26px 26px 28px" }}>
          <div className="gn-pulse" style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #E0A23A, #B25E00)", color: "#fff", fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 14px 26px -12px #B25E00" }}>⏰</div>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 700, color: "#14213A" }}>Es-tu toujours en service ?</div>
          <div style={{ fontSize: 13.5, color: "#3A4D6B", lineHeight: 1.55, margin: "8px 0 14px" }}>Confirme ta présence pour que ton temps de service continue d'être compté. Sans réponse, ton service sera arrêté.</div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 34, fontWeight: 700, color: reste < 60000 ? "#C0172D" : "#14213A" }}>{mm}:{ss}</div>
          <div style={{ height: 6, background: "#D3DDEA", borderRadius: 4, overflow: "hidden", margin: "10px 0 20px" }}><div style={{ width: `${part}%`, height: "100%", background: reste < 60000 ? "#C0172D" : "#2E7D4F", transition: "width .5s linear" }} /></div>
          <button type="button" onClick={onConfirm} autoFocus className="gh-btn-anim" style={{ width: "100%", padding: "14px 0", border: "none", borderRadius: 12, background: "linear-gradient(180deg, #3A9A62, #2E7D4F)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 16px 28px -14px #2E7D4F", fontFamily: "inherit" }}>✅ Je suis là</button>
        </div>
      </div>
    </div>
  );
}
