// config.js
// Semua pengaturan bot ada di sini. Token & Client ID diambil dari .env (JANGAN hardcode di sini).

const fs = require("fs");
const path = require("path");

const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,

  // Anti-spam
  SPAM: {
    MAX_MESSAGES: 5, // jumlah pesan maksimal
    TIME_WINDOW_MS: 7000, // dalam rentang waktu ini (ms)
    TIMEOUT_DURATION_MS: 10 * 60 * 1000, // durasi timeout (10 menit)
    DELETE_SPAM_MESSAGES: true,
  },

  // Anti-phishing
  PHISHING: {
    BLOCKED_KEYWORDS: [
      "discord-nitro",
      "discordnitro",
      "discrod",
      "dlscord",
      "steamcommunuty",
      "steamcommunity-",
      "free-nitro",
      "nitro-nitro",
      "discord-gift",
      "discordgift",
      "airdrop-claim",
      "claim-airdrop",
    ],
    SUSPICIOUS_SHORTENERS: ["bit.ly", "tinyurl.com", "cutt.ly", "shorturl.at", "is.gd"],
    TIMEOUT_DURATION_MS: 30 * 60 * 1000, // 30 menit (dipakai kalau AUTO_KICK dimatikan / gagal kick)
    DELETE_MESSAGE: true,
    AUTO_KICK: true, // true = akun terdeteksi phishing langsung di-kick (indikasi akun kena hack)
  },

  // Trap channel (honeypot): channel jebakan. User biasa dilarang kirim pesan di sini.
  // Siapa pun yang mengirim pesan di channel ini dianggap scammer / akun kena hack,
  // langsung di-kick dan semua pesannya di seluruh server dibersihkan.
  TRAP: {
    AUTO_KICK: true, // true = kick user yang kena jebakan; false = fallback timeout
    TIMEOUT_DURATION_MS: 60 * 60 * 1000, // durasi timeout kalau kick dimatikan/gagal (1 jam)
  },
};

// ---------- Penyimpanan settings per-server (settings.json) ----------
const SETTINGS_PATH = path.join(__dirname, "settings.json");

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Gagal membaca settings.json:", err);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Gagal menyimpan settings.json:", err);
  }
}

let settings = loadSettings(); // { [guildId]: { logChannelId: "...", trapChannelId: "..." } }

function getLogChannelId(guildId) {
  return settings[guildId]?.logChannelId ?? null;
}

function setLogChannelId(guildId, channelId) {
  settings[guildId] = { ...(settings[guildId] || {}), logChannelId: channelId };
  saveSettings(settings);
}

function getTrapChannelId(guildId) {
  return settings[guildId]?.trapChannelId ?? null;
}

function setTrapChannelId(guildId, channelId) {
  settings[guildId] = { ...(settings[guildId] || {}), trapChannelId: channelId };
  saveSettings(settings);
}

module.exports = {
  CONFIG,
  getLogChannelId,
  setLogChannelId,
  getTrapChannelId,
  setTrapChannelId,
};
