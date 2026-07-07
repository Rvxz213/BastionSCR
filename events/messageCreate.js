// events/messageCreate.js
const { CONFIG, getTrapChannelId } = require("../config.js");
const { baseEmbed, sendLog } = require("../utils/logger.js");
const { isPhishingMessage, isSpam, timeoutMember, kickMember } = require("../utils/antiSpam.js");
const { purgeUserMessages } = require("../utils/purge.js");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    let member = message.member;
    const content = message.content;

    // 0. Trap channel (honeypot): siapa pun yang mengirim pesan di sini dianggap
    // scammer / akun kena hack. Langsung kick + sapu bersih semua pesannya.
    const trapChannelId = getTrapChannelId(message.guild.id);
    if (trapChannelId && message.channel.id === trapChannelId) {
      // Member bisa null kalau belum ter-cache (Partials). Fetch dulu supaya kick tidak gagal diam-diam.
      if (!member) {
        member = await message.guild.members.fetch(message.author.id).catch(() => null);
      }

      // Jangan jebak admin/moderator yang bisa manage server (kemungkinan sedang mengelola).
      if (member?.permissions?.has("ManageGuild")) return;

      const attachmentCount = message.attachments.size;

      // Kick/timeout dulu (cepat) supaya user langsung tersingkir, baru sapu pesannya.
      // Purge menyisir semua channel dan bisa makan waktu; jangan sampai menunda kick.
      await message.delete().catch(() => {});

      let actionTaken = "Tidak ada aksi (gagal kick & timeout, cek permission bot)";
      if (CONFIG.TRAP.AUTO_KICK) {
        const kicked = await kickMember(member, "Terjebak di trap channel (indikasi scammer/akun kena hack)");
        if (kicked) {
          actionTaken = "User di-KICK dari server (terjebak di trap channel)";
        } else {
          const timedOut = await timeoutMember(
            member,
            CONFIG.TRAP.TIMEOUT_DURATION_MS,
            "Terjebak di trap channel"
          );
          if (timedOut) actionTaken = "Gagal kick (role bot lebih rendah?), fallback ke timeout";
        }
      } else {
        const timedOut = await timeoutMember(
          member,
          CONFIG.TRAP.TIMEOUT_DURATION_MS,
          "Terjebak di trap channel"
        );
        if (timedOut) actionTaken = "User di-timeout";
      }

      const { channelsPurged, messagesDeleted } = await purgeUserMessages(
        message.guild,
        message.author.id
      );

      await sendLog(
        message.guild,
        baseEmbed("🪤 Trap Channel Dipicu", 0xff0000).addFields(
          { name: "User", value: `${message.author.username} (${message.author.id})` },
          { name: "Channel", value: `<#${message.channel.id}>` },
          { name: "Isi Pesan", value: content.slice(0, 1000) || "*(tidak ada teks)*" },
          {
            name: "Lampiran",
            value: attachmentCount > 0 ? `${attachmentCount} file (gambar/media)` : "Tidak ada",
          },
          { name: "Aksi", value: actionTaken },
          {
            name: "🧹 Pembersihan Pesan",
            value: `${messagesDeleted} pesan dihapus dari ${channelsPurged} channel`,
          }
        )
      );
      return;
    }

    // 1. Cek phishing
    const phishingCheck = isPhishingMessage(content);
    if (phishingCheck.isPhishing) {
      // Member bisa null kalau belum ter-cache (Partials). Fetch dulu supaya kick tidak gagal diam-diam.
      if (!member) {
        member = await message.guild.members.fetch(message.author.id).catch(() => null);
      }

      // Hapus pesan pemicu dulu, lalu kick/timeout (cepat). Purge menyisir semua channel
      // dan bisa makan waktu, jadi dijalankan setelah user tersingkir.
      if (CONFIG.PHISHING.DELETE_MESSAGE) await message.delete().catch(() => {});

      // Akun terindikasi kena hack/phishing -> langsung kick.
      // Kalau AUTO_KICK dimatikan atau kick gagal (mis. kurang permission), fallback ke timeout.
      let actionTaken = "Tidak ada aksi (gagal kick & timeout, cek permission bot)";
      if (CONFIG.PHISHING.AUTO_KICK) {
        const kicked = await kickMember(
          member,
          `Akun terindikasi hack/phishing: ${phishingCheck.reason}`
        );
        if (kicked) {
          actionTaken = "User di-KICK dari server (indikasi akun kena hack)";
        } else {
          const timedOut = await timeoutMember(
            member,
            CONFIG.PHISHING.TIMEOUT_DURATION_MS,
            `Terdeteksi phishing: ${phishingCheck.reason}`
          );
          actionTaken = timedOut
            ? "Gagal kick (role bot lebih rendah?), fallback ke timeout"
            : actionTaken;
        }
      } else {
        const timedOut = await timeoutMember(
          member,
          CONFIG.PHISHING.TIMEOUT_DURATION_MS,
          `Terdeteksi phishing: ${phishingCheck.reason}`
        );
        actionTaken = timedOut ? "User di-timeout" : actionTaken;
      }

      // Sapu bersih semua pesan lain dari user ini di seluruh server
      const { channelsPurged, messagesDeleted } = await purgeUserMessages(
        message.guild,
        message.author.id
      );

      await sendLog(
        message.guild,
        baseEmbed("🚨 Akun Terindikasi Hack/Phishing", 0xff0000).addFields(
          { name: "User", value: `${message.author.username} (${message.author.id})` },
          { name: "Channel", value: `<#${message.channel.id}>` },
          { name: "Alasan", value: phishingCheck.reason },
          { name: "Isi Pesan", value: content.slice(0, 1000) || "-" },
          { name: "Aksi", value: actionTaken },
          {
            name: "🧹 Pembersihan Pesan",
            value: `${messagesDeleted} pesan dihapus dari ${channelsPurged} channel`,
          }
        )
      );
      return;
    }

    // 2. Cek spam
    const spamCheck = isSpam(message.author.id, content);
    if (spamCheck.spam) {
      if (CONFIG.SPAM.DELETE_SPAM_MESSAGES) await message.delete().catch(() => {});
      const timedOut = await timeoutMember(
        member,
        CONFIG.SPAM.TIMEOUT_DURATION_MS,
        `Terdeteksi spam: ${spamCheck.reason}`
      );

      const { channelsPurged, messagesDeleted } = await purgeUserMessages(
        message.guild,
        message.author.id
      );

      await sendLog(
        message.guild,
        baseEmbed("⚠️ Spam Terdeteksi", 0xffa500).addFields(
          { name: "User", value: `${message.author.username} (${message.author.id})` },
          { name: "Channel", value: `<#${message.channel.id}>` },
          { name: "Alasan", value: spamCheck.reason },
          { name: "Aksi", value: timedOut ? "User di-timeout" : "Terdeteksi (gagal timeout)" },
          {
            name: "🧹 Pembersihan Pesan",
            value: `${messagesDeleted} pesan dihapus dari ${channelsPurged} channel`,
          }
        )
      );
    }
  },
};
