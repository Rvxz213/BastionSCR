// utils/purge.js
// Menghapus semua pesan terbaru dari satu user di semua channel teks server.
// Dipakai saat user terdeteksi phishing/spam, supaya link/pesan berbahaya
// tidak hanya terhapus di satu channel tapi disapu bersih dari seluruh server.

const { ChannelType } = require("discord.js");

const MAX_MESSAGE_AGE_MS = 13 * 24 * 60 * 60 * 1000; // Discord hanya izinkan bulkDelete < 14 hari
const FETCH_LIMIT = 100; // maksimal pesan yang dicek per channel setiap panggilan

/**
 * Hapus semua pesan dari userId di seluruh channel teks yang bisa diakses bot.
 * Mengembalikan { channelsPurged, messagesDeleted }
 */
async function purgeUserMessages(guild, userId) {
  let channelsPurged = 0;
  let messagesDeleted = 0;

  const channels = guild.channels.cache.filter(
    (ch) =>
      ch.type === ChannelType.GuildText ||
      ch.type === ChannelType.GuildAnnouncement ||
      ch.type === ChannelType.PublicThread ||
      ch.type === ChannelType.PrivateThread
  );

  for (const [, channel] of channels) {
    try {
      const perms = channel.permissionsFor(guild.members.me);
      if (!perms?.has("ViewChannel") || !perms.has("ManageMessages") || !perms.has("ReadMessageHistory")) {
        continue; // bot tidak punya izin di channel ini, lewati
      }

      const messages = await channel.messages.fetch({ limit: FETCH_LIMIT }).catch(() => null);
      if (!messages) continue;

      const now = Date.now();
      const toDelete = messages.filter(
        (m) => m.author.id === userId && now - m.createdTimestamp < MAX_MESSAGE_AGE_MS
      );

      if (toDelete.size === 0) continue;

      if (toDelete.size === 1) {
        await toDelete.first().delete().catch(() => {});
        messagesDeleted += 1;
      } else {
        const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
        messagesDeleted += deleted ? deleted.size : 0;
      }
      channelsPurged += 1;
    } catch (err) {
      console.error(`Gagal purge pesan di channel ${channel.id}:`, err.message);
    }
  }

  return { channelsPurged, messagesDeleted };
}

module.exports = { purgeUserMessages };
