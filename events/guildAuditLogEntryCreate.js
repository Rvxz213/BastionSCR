// events/guildAuditLogEntryCreate.js
// Event ini terpicu setiap kali ada entri baru di Audit Log server —
// artinya HAMPIR SEMUA aksi admin/moderator (pindah voice, ubah channel,
// ubah role, kick, ban, edit permission, dll) otomatis kelogging di sini.
//
// Catatan: event ini butuh intent GuildModeration dan hanya tersedia di discord.js v14.13+.

const { AuditLogEvent } = require("discord.js");
const { baseEmbed, sendLog } = require("../utils/logger.js");

// Mapping AuditLogEvent -> { title, color, describe(entry) }
// describe() mengembalikan teks ringkas tentang apa yang berubah.
const EVENT_MAP = {
  // Catatan: MemberMove & MemberDisconnect SENGAJA tidak dimasukkan di sini.
  // Audit log Discord untuk 2 aksi ini tidak menyertakan ID member spesifik
  // (cuma jumlah member yang dipindah/diputus). Detail member yang akurat
  // sudah dihandle di events/ready.js lewat listener voiceStateUpdate,
  // yang mengkorelasikan audit log dengan event voice state per-member.
  [AuditLogEvent.MemberUpdate]: {
    title: "✏️ Member Diubah (Nickname/Mute/Deafen)",
    color: 0x3498db,
    describe: (entry) => {
      const changes = entry.changes?.map((c) => `${c.key}: ${c.old ?? "-"} → ${c.new ?? "-"}`).join(", ");
      return `Target: <@${entry.targetId}>\nPerubahan: ${changes || "-"}`;
    },
  },
  [AuditLogEvent.MemberRoleUpdate]: {
    title: "🎭 Role Member Diubah",
    color: 0x9b59b6,
    describe: (entry) => {
      const changes = entry.changes
        ?.map((c) => {
          const roles = (c.new || c.old || []).map((r) => `<@&${r.id}>`).join(", ");
          return `${c.key === "$add" ? "➕ Ditambah" : "➖ Dihapus"}: ${roles}`;
        })
        .join("\n");
      return `Target: <@${entry.targetId}>\n${changes || "-"}`;
    },
  },
  [AuditLogEvent.MemberKick]: {
    title: "👢 Member Di-Kick",
    color: 0xe67e22,
    describe: (entry) => `Target: <@${entry.targetId}>\nAlasan: ${entry.reason || "-"}`,
  },
  [AuditLogEvent.MemberBanAdd]: {
    title: "🔨 Member Di-Ban",
    color: 0x992d22,
    describe: (entry) => `Target: <@${entry.targetId}>\nAlasan: ${entry.reason || "-"}`,
  },
  [AuditLogEvent.MemberBanRemove]: {
    title: "♻️ Ban Dicabut",
    color: 0x2ecc71,
    describe: (entry) => `Target: <@${entry.targetId}>`,
  },
  [AuditLogEvent.ChannelCreate]: {
    title: "📁 Channel Dibuat",
    color: 0x2ecc71,
    describe: (entry) => `Channel: ${entry.target?.name ?? entry.targetId}`,
  },
  [AuditLogEvent.ChannelDelete]: {
    title: "🗑️ Channel Dihapus",
    color: 0xe74c3c,
    describe: (entry) => `Channel: ${entry.target?.name ?? entry.targetId}`,
  },
  [AuditLogEvent.ChannelUpdate]: {
    title: "🛠️ Channel Diubah",
    color: 0x3498db,
    describe: (entry) => {
      const changes = entry.changes?.map((c) => `${c.key}: ${c.old ?? "-"} → ${c.new ?? "-"}`).join("\n");
      return `Channel: ${entry.target?.name ?? entry.targetId}\n${changes || "-"}`;
    },
  },
  [AuditLogEvent.RoleCreate]: {
    title: "🎭 Role Dibuat",
    color: 0x2ecc71,
    describe: (entry) => `Role: ${entry.target?.name ?? entry.targetId}`,
  },
  [AuditLogEvent.RoleDelete]: {
    title: "🗑️ Role Dihapus",
    color: 0xe74c3c,
    describe: (entry) => `Role: ${entry.target?.name ?? entry.targetId}`,
  },
  [AuditLogEvent.RoleUpdate]: {
    title: "🛠️ Role Diubah",
    color: 0x3498db,
    describe: (entry) => {
      const changes = entry.changes?.map((c) => `${c.key}: ${c.old ?? "-"} → ${c.new ?? "-"}`).join("\n");
      return `Role: ${entry.target?.name ?? entry.targetId}\n${changes || "-"}`;
    },
  },
  [AuditLogEvent.MessageDelete]: {
    title: "🗑️ Pesan Dihapus (oleh Moderator)",
    color: 0x999999,
    describe: (entry) => `Target: <@${entry.targetId}>\nJumlah: ${entry.extra?.count ?? 1} pesan di <#${entry.extra?.channel?.id}>`,
  },
  [AuditLogEvent.MessageBulkDelete]: {
    title: "🧹 Pesan Dihapus Massal",
    color: 0x999999,
    describe: (entry) => `Channel: ${entry.target?.name ?? entry.targetId}\nJumlah: ${entry.extra?.count ?? "-"} pesan`,
  },
};

module.exports = {
  name: "guildAuditLogEntryCreate",
  once: false,
  async execute(auditLogEntry, guild) {
    try {
      const mapping = EVENT_MAP[auditLogEntry.action];
      if (!mapping) return; // aksi tidak ada di daftar yang kita log

      const executor = auditLogEntry.executor;
      const embed = baseEmbed(mapping.title, mapping.color).addFields(
        { name: "Dilakukan Oleh", value: executor ? `${executor.username} (${executor.id})` : "Tidak diketahui" },
        { name: "Detail", value: mapping.describe(auditLogEntry) || "-" }
      );

      await sendLog(guild, embed);
    } catch (err) {
      console.error("Gagal memproses audit log entry:", err.message);
    }
  },
};
