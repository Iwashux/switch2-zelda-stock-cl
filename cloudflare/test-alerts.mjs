// Prueba manual de los canales de aviso. Los que no estén configurados se omiten.
import { sendTelegram, sendNtfy } from "./src/monitor-core.js";

const env = process.env;

if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_CHAT_ID) {
  // Ayuda para encontrar TELEGRAM_CHAT_ID: chats que le escribieron al bot.
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`);
  const data = await r.json();
  if (!data.ok) console.log(`Telegram rechazó el token (${data.description}): vuelve a guardar TELEGRAM_BOT_TOKEN.`);
  const chats = new Map();
  for (const u of data.result || []) {
    const chat = (u.message || u.edited_message || u.channel_post || u.my_chat_member || {}).chat;
    if (chat) chats.set(chat.id, `${chat.type} · ${chat.title || chat.username || chat.first_name || "sin nombre"}`);
  }
  console.log(chats.size
    ? "Chats que ve el bot (guarda el ID correcto como TELEGRAM_CHAT_ID):"
    : "El bot no ve chats: escríbele (o agrégalo a un grupo y envía /start) y vuelve a ejecutar.");
  for (const [id, label] of chats) console.log(`  ${id}  ${label}`);
}

const results = {
  telegram: await sendTelegram(env, "PRUEBA del monitor Zelda", "Si ves este mensaje, los avisos por Telegram funcionan."),
  [env.NTFY_EMAIL ? "ntfy + correo" : "ntfy"]: await sendNtfy(
    env,
    "PRUEBA del monitor Zelda",
    "Si ves esta notificación, ntfy funciona." + (env.NTFY_EMAIL ? " También debería llegarte un correo." : ""),
    `https://github.com/${env.GITHUB_REPOSITORY || ""}`,
  ),
};

console.table(Object.fromEntries(
  Object.entries(results).map(([channel, r]) => [channel, r.sent ? "✅ enviado" : `⏭️ ${r.reason}`]),
));

const values = Object.values(results);
if (values.every((r) => r.reason === "not_configured")) {
  console.error("Ningún canal configurado: agrega los secrets (ver README).");
  process.exitCode = 1;
} else if (values.some((r) => !r.sent && r.reason !== "not_configured")) {
  process.exitCode = 1;
}
