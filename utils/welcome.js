// utils/welcome.js
// Kirim embed tutorial otomatis saat bot diundang ke server baru.
// Menjelaskan cara setup (/setup, /trap) dan bagaimana bot bekerja.

const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

// Cari channel teks pertama yang bisa dikirimi pesan oleh bot.
// Prioritas: system channel -> channel teks mana pun yang bot punya izin SendMessages.
function findWritableChannel(guild) {
  const me = guild.members.me;

  const sys = guild.systemChannel;
  if (sys && sys.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
    return sys;
  }

  const textChannels = guild.channels.cache
    .filter((ch) => ch.type === ChannelType.GuildText)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const [, ch] of textChannels) {
    if (ch.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
      return ch;
    }
  }
  return null;
}

function buildWelcomeEmbed(guild) {
  return new EmbedBuilder()
    .setTitle("👋 Terima kasih sudah mengundang saya!")
    .setColor(0x5865f2)
    .setDescription(
      `Saya bot moderasi & logging untuk **${guild.name}**.\n` +
        "Ikuti langkah singkat di bawah ini supaya saya langsung aktif."
    )
    .addFields(
      {
        name: "1️⃣ Jalankan `/setup`",
        value:
          "Menyiapkan channel log & mengaktifkan anti-spam/anti-phishing.\n" +
          "• Tanpa argumen → saya buatkan channel `#mod-logs` otomatis.\n" +
          "• `/setup channel:#nama` → pakai channel log yang sudah ada.",
      },
      {
        name: "2️⃣ (Opsional) Jalankan `/trap`",
        value:
          "Membuat *trap channel* (honeypot) anti-scammer.\n" +
          "• Tanpa argumen → saya buat channel jebakan otomatis.\n" +
          "• `/trap channel:#nama` → jadikan channel tertentu sebagai jebakan.",
      },
      {
        name: "3️⃣ Cek `/status`",
        value: "Melihat konfigurasi bot di server ini kapan saja.",
      },
      {
        name: "🛡️ Bagaimana saya bekerja",
        value:
          "• **Anti-spam** — flooding / pesan berulang → user di-timeout & pesannya dibersihkan.\n" +
          "• **Anti-phishing** — link mencurigakan / kata kunci scam → akun di-kick (indikasi kena hack) & pesannya disapu di seluruh channel.\n" +
          "• **Trap channel** — siapa pun yang kirim pesan di sana langsung di-kick & semua pesannya di seluruh channel dihapus.\n" +
          "• **Logging** — join/leave, edit/hapus pesan, perubahan role/channel, ban, dan aktivitas voice tercatat di channel log.",
      },
      {
        name: "🔐 Permission yang saya butuhkan",
        value:
          "Pastikan role saya punya: **Manage Channels**, **Manage Messages**, **Kick Members**, **Moderate Members** (timeout), dan **View Audit Log**.\n" +
          "Untuk kick berjalan, letakkan role bot **di atas** role member yang mau dimoderasi.",
      }
    )
    .setFooter({ text: "Mulai dengan menjalankan /setup" })
    .setTimestamp();
}

// Kirim tutorial ke channel yang bisa ditulis. Aman kalau tidak ada channel yang cocok.
async function sendWelcome(guild) {
  try {
    const channel = findWritableChannel(guild);
    if (!channel) return;
    await channel.send({ embeds: [buildWelcomeEmbed(guild)] }).catch(() => {});
  } catch (err) {
    console.error("Gagal mengirim welcome embed:", err.message);
  }
}

module.exports = { sendWelcome, buildWelcomeEmbed };
