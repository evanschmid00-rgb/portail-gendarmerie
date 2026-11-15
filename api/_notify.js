// Fonction Vercel : envoie une notification dans Discord via un webhook.
// Le lien du webhook n'est jamais dans le code : il est dans les variables d'environnement Vercel.

const TYPES = {
  candidature: { titre: "📝 Nouvelle candidature", couleur: 0x16305c },
  pv: { titre: "📄 Nouveau procès-verbal", couleur: 0xb08d57 },
  service_debut: { titre: "🟢 Prise de service", couleur: 0x2e7d4f },
  service_fin: { titre: "🔴 Fin de service", couleur: 0x9c2b2b },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { type, texte } = req.body || {};
  const t = TYPES[type];
  if (!t) return res.status(400).json({ error: "Type inconnu" });

  // Un webhook par type si tu veux (ex. DISCORD_WEBHOOK_PV), sinon le webhook général
  const url = process.env["DISCORD_WEBHOOK_" + type.toUpperCase()] || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return res.status(200).json({ ignore: "aucun webhook configuré" });

  const description = String(texte || "").replace(/[@`]/g, "").slice(0, 300); // pas de mentions, texte court

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: t.titre, description, color: t.couleur, timestamp: new Date().toISOString() }],
        allowed_mentions: { parse: [] },
      }),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
