// utils/antiSpam.js
const { CONFIG } = require("../config.js");

// Menyimpan riwayat pesan tiap user: Map<userId, {timestamps: number[], lastContent: string}>
const messageTracker = new Map();

// ---------- Deteksi Phishing ----------
function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return text.match(urlRegex) || [];
}

function isPhishingMessage(content) {
  const lower = content.toLowerCase();
  const matchedKeyword = CONFIG.PHISHING.BLOCKED_KEYWORDS.find((kw) => lower.includes(kw));
  if (matchedKeyword) return { isPhishing: true, reason: `Mengandung kata kunci mencurigakan: "${matchedKeyword}"` };

  const urls = extractUrls(content);
  for (const url of urls) {
    try {
      const { hostname } = new URL(url);
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        return { isPhishing: true, reason: `Link menggunakan alamat IP langsung: ${hostname}` };
      }
      if (CONFIG.PHISHING.SUSPICIOUS_SHORTENERS.some((s) => hostname.includes(s))) {
        return { isPhishing: true, reason: `Menggunakan URL shortener yang berisiko: ${hostname}` };
      }
    } catch {
      // URL tidak valid, abaikan
    }
  }
  return { isPhishing: false };
}

// ---------- Deteksi Spam ----------
function isSpam(userId, content) {
  const now = Date.now();
  const record = messageTracker.get(userId) || { timestamps: [], lastContent: "" };

  record.timestamps = record.timestamps.filter((t) => now - t < CONFIG.SPAM.TIME_WINDOW_MS);
  record.timestamps.push(now);

  const isFlood = record.timestamps.length > CONFIG.SPAM.MAX_MESSAGES;
  const isRepeatedContent =
    record.lastContent && record.lastContent === content && record.timestamps.length > 2;

  record.lastContent = content;
  messageTracker.set(userId, record);

  if (isFlood) return { spam: true, reason: "Mengirim pesan terlalu cepat (flooding)" };
  if (isRepeatedContent) return { spam: true, reason: "Mengirim pesan yang sama berulang kali" };
  return { spam: false };
}

// ---------- Aksi moderasi ----------
async function timeoutMember(member, durationMs, reason) {
  try {
    if (member.moderatable) {
      await member.timeout(durationMs, reason);
      return true;
    }
  } catch (err) {
    console.error("Gagal timeout member:", err);
  }
  return false;
}

async function kickMember(member, reason) {
  try {
    if (member.kickable) {
      await member.kick(reason);
      return true;
    }
  } catch (err) {
    console.error("Gagal kick member:", err);
  }
  return false;
}

module.exports = { isPhishingMessage, isSpam, timeoutMember, kickMember };
