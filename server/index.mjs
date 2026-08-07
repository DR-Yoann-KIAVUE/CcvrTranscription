// Service d'envoi des e-mails « mot de passe oublié » de CCVR Dictée.
// Déployé sur Render ; la clé Resend reste ici (variable d'environnement),
// jamais dans l'application distribuée.
//
// POST /forgot-password  { "to": "adresse@ex.fr", "code": "123456" }
//   -> envoie le code par e-mail via Resend. Modèle de message fixe :
//      l'endpoint ne peut servir qu'à envoyer un code à 6 chiffres.

import http from "node:http";

const PORT = process.env.PORT || 10000;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "CCVR Dictée <dictee@dryk.fr>";

// Garde-fou anti-abus : l'endpoint est public, on limite les envois.
const hits = new Map();
function allow(key, max) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  if (req.method !== "POST" || req.url !== "/forgot-password") {
    res.writeHead(404).end();
    return;
  }

  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 4096) req.destroy();
  });
  req.on("end", async () => {
    try {
      const { to, code } = JSON.parse(body || "{}");
      if (
        typeof to !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
        !/^\d{6}$/.test(String(code))
      ) {
        res.writeHead(400).end("Requête invalide.");
        return;
      }
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "?";
      if (!allow(`ip:${ip}`, 20) || !allow(`to:${to.toLowerCase()}`, 5)) {
        res.writeHead(429).end("Trop de demandes, réessayez plus tard.");
        return;
      }
      if (!RESEND_API_KEY) {
        res.writeHead(500).end("RESEND_API_KEY non configurée sur le serveur.");
        return;
      }
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: [to],
          subject: "CCVR Dictée — votre code de connexion",
          text:
            `Bonjour,\n\nVotre nouveau code d'accès (6 chiffres) : ${code}\n\n` +
            "Saisissez-le sur l'écran de connexion de CCVR Dictée.\n" +
            "Vous pourrez ensuite le remplacer par un code de votre choix dans les Réglages.\n\n" +
            "Si vous n'êtes pas à l'origine de cette demande, quelqu'un a accès à cet ordinateur.",
        }),
      });
      if (!r.ok) {
        res.writeHead(502).end(`Envoi refusé par Resend : ${await r.text()}`);
        return;
      }
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end('{"ok":true}');
    } catch {
      res.writeHead(400).end("Requête invalide.");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Service e-mail CCVR Dictée démarré sur le port ${PORT}`);
});
