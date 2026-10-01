// Récupère la photo (tête du personnage) d'un compte Roblox pour la carte CIPC.
// Usage : /api/roblox-head?pseudo=MonPseudo   ou   /api/roblox-head?id=123456

export default async function handler(req, res) {
  try {
    let id = String(req.query.id || "");
    let nom = "";

    if (!id) {
      const pseudo = String(req.query.pseudo || "").trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudo)) return res.status(200).json({ message: "Pseudo Roblox invalide." });
      const r = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [pseudo], excludeBannedUsers: true }),
      });
      const j = await r.json();
      const u = j && j.data && j.data[0];
      if (!u) return res.status(200).json({ message: "Pseudo Roblox introuvable." });
      id = String(u.id);
      nom = u.name;
    } else if (!/^\d{1,15}$/.test(id)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    let imageUrl = "";
    for (let i = 0; i < 3 && !imageUrl; i++) {
      const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`);
      const j = await r.json();
      const d = j && j.data && j.data[0];
      if (d && d.state === "Completed" && d.imageUrl) imageUrl = d.imageUrl;
      else await new Promise((ok) => setTimeout(ok, 500));
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ id, nom, imageUrl });
  } catch (e) {
    return res.status(200).json({ message: "Roblox ne répond pas, réessaie dans un instant." });
  }
}
