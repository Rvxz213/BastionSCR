/**
 * Discord Bot - Logging + Anti-Spam/Phishing + Setup Otomatis
 * ---------------------------------------------
 * Struktur folder:
 *   index.js        -> entry point, load semua event
 *   config.js        -> konfigurasi & penyimpanan settings per-server
 *   events/          -> handler tiap event Discord (ready, messageCreate, dll)
 *   utils/           -> fungsi bantu (logger, anti-spam/phishing)
 *
 * Cara pakai:
 *  1. Isi TOKEN dan CLIENT_ID di file .env
 *  2. Undang bot dengan scope "bot" + "applications.commands" dan permission:
 *     Manage Channels, Manage Messages, Moderate Members (Timeout), View Audit Log.
 *  3. npm install
 *  4. npm start  (atau: node index.js)
 *  5. Di server Discord, jalankan perintah: /setup
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { CONFIG } = require("./config.js");

if (!CONFIG.TOKEN || !CONFIG.CLIENT_ID) {
  console.error("❌ TOKEN atau CLIENT_ID belum diisi di file .env. Bot tidak bisa jalan.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ---------- Auto-load semua event dari folder events/ ----------
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`✅ Event dimuat: ${event.name}`);
}

client.login(CONFIG.TOKEN);
