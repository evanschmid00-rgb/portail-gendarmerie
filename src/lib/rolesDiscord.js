// lib/rolesDiscord.js — Appels au serveur pour les rôles Discord automatiques (liste, titularisation, synchronisation).
import { auth } from "../firebase";

// Via /api/attribuer-role : action "roles" (liste du serveur), "titulariser" (avec uid), "synchroniser"
export async function appelRolesDiscord(action, extra = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return { ok: false, message: "Non connecté." };
    const idToken = await user.getIdToken();
    const r = await fetch("/api/attribuer-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, action, ...extra }) });
    return await r.json();
  } catch (e) { return { ok: false, message: "Le serveur ne répond pas." }; }
}
