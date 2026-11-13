// composants/EcranChargement.jsx — écran de démarrage NÉOGEND (logo, barre de progression, état du réseau).
import React, { useEffect, useState } from "react";
import { LogoNeogend } from "./LogoNeogend.jsx";

const ETAPES = ["Établissement de la liaison chiffrée…", "Vérification du VPN d'État…", "Authentification de la carte professionnelle…", "Chargement de votre espace…"];

export function EcranChargement({ message }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => Math.min(n + 1, ETAPES.length - 1)), 900); return () => clearInterval(t); }, []);
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(700px 420px at 90% 0%, rgba(92,200,255,0.3), transparent 70%), linear-gradient(160deg, #0B3A8F 0%, #1D5BD6 55%, #0A2A6B 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 24, color: "#fff", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", textAlign: "center" }}>
      <style>{`@keyframes gnBarre { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } } @keyframes gnRespire { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }`}</style>
      <div style={{ background: "#fff", borderRadius: 24, padding: "18px 34px", boxShadow: "0 30px 60px -28px rgba(0,0,0,0.8)", animation: "gnRespire 2.4s ease-in-out infinite" }}><LogoNeogend hauteur={84} /></div>
      <div style={{ fontSize: 12, letterSpacing: 2.6, fontWeight: 700, textTransform: "uppercase", opacity: 0.9, lineHeight: 1.6 }}>Nouvel Équipement Opérationnel<br />de la Gendarmerie</div>
      <div style={{ width: "min(320px, 80vw)", height: 6, borderRadius: 4, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
        <div style={{ width: "40%", height: "100%", borderRadius: 4, background: "#fff", animation: "gnBarre 1.3s ease-in-out infinite" }} />
      </div>
      <div style={{ fontSize: 13.5, minHeight: 20, opacity: 0.95 }}>{message || ETAPES[i]}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 700 }}>🔒 Réseau chiffré</span>
        <span style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 700 }}>🛡️ VPN d'État actif</span>
      </div>
      <div style={{ position: "absolute", bottom: 18, fontSize: 11, opacity: 0.7 }}>Site de jeu de rôle — usage RP uniquement</div>
    </div>
  );
}
