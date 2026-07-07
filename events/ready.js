// events/ready.js
const {
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const {
  CONFIG,
  getLogChannelId,
  setLogChannelId,
  getTrapChannelId,
  setTrapChannelId,
} = require("../config.js");
const { baseEmbed, sendLog } = require("../utils/logger.js");
const { sendWelcome } = require("../utils/welcome.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup otomatis: siapkan channel log & aktifkan anti-spam/phishing di server ini")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel log yang mau dipakai (opsional, jika kosong bot akan buat otomatis)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("trap")
    .setDescription("Atur trap channel (honeypot): siapa pun yang kirim pesan di sana langsung di-kick & dibersihkan")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel jebakan (opsional, jika kosong bot akan buat otomatis)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Lihat status konfigurasi bot di server ini")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
].map((cmd) => cmd.toJSON());

async function registerCommandsForGuild(guildId) {
  try {
    const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
    await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, guildId), {
      body: commands,
    });
  } catch (err) {
    console.error(`Gagal register command untuk guild ${guildId}:`, err);
  }
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`Bot login sebagai ${client.user.tag}`);

    const guilds = await client.guilds.fetch();
    for (const [guildId] of guilds) {
      await registerCommandsForGuild(guildId);
    }
    console.log(`Slash command terdaftar di ${guilds.size} server.`);

    // Saat bot baru diundang ke server: daftarkan command + kirim tutorial setup.
    client.on("guildCreate", async (guild) => {
      await registerCommandsForGuild(guild.id);
      await sendWelcome(guild);
    });

    // ---------- Handler: Slash Command ----------
    client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (!interaction.guild) return;

      if (interaction.commandName === "setup") {
        await interaction.deferReply({ ephemeral: true });

        const chosenChannel = interaction.options.getChannel("channel");
        let logChannel = chosenChannel;

        try {
          if (!logChannel) {
            logChannel = await interaction.guild.channels.create({
              name: "mod-logs",
              type: ChannelType.GuildText,
              reason: "Dibuat otomatis oleh /setup untuk log moderasi bot",
              permissionOverwrites: [
                {
                  id: interaction.guild.roles.everyone.id,
                  deny: [PermissionFlagsBits.SendMessages],
                },
              ],
            });
          }

          setLogChannelId(interaction.guild.id, logChannel.id);

          await interaction.editReply({
            content:
              `✅ **Setup selesai!** Bot sudah siap dipakai di server ini.\n\n` +
              `📋 Channel log: <#${logChannel.id}>\n` +
              `🛡️ Anti-spam: aktif\n` +
              `🚨 Anti-phishing: aktif\n` +
              `📥 Log join/leave, edit/hapus pesan, voice, dan ban: aktif\n\n` +
              `Tidak perlu konfigurasi tambahan — semua sudah berjalan otomatis.`,
          });

          await sendLog(
            interaction.guild,
            baseEmbed("⚙️ Bot Berhasil Di-setup", 0x2ecc71).addFields(
              { name: "Diatur Oleh", value: `${interaction.user.username} (${interaction.user.id})` },
              { name: "Channel Log", value: `<#${logChannel.id}>` }
            )
          );
        } catch (err) {
          console.error("Gagal setup:", err);
          await interaction.editReply({
            content:
              "❌ Gagal melakukan setup. Pastikan bot punya permission **Manage Channels** di server ini, lalu coba lagi.",
          });
        }
        return;
      }

      if (interaction.commandName === "trap") {
        // Hard guard: hanya admin yang boleh set trap channel (default permission bisa
        // di-override lewat Server Settings, jadi kita cek ulang di sini).
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            ephemeral: true,
            content: "❌ Hanya **Administrator** yang boleh mengatur trap channel.",
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const chosenChannel = interaction.options.getChannel("channel");
        let trapChannel = chosenChannel;

        try {
          if (!trapChannel) {
            trapChannel = await interaction.guild.channels.create({
              name: "⚠️-jangan-kirim-pesan",
              type: ChannelType.GuildText,
              reason: "Dibuat otomatis oleh /trap sebagai honeypot anti-scammer",
              topic:
                "🪤 TRAP CHANNEL — JANGAN kirim pesan apa pun di sini. " +
                "Siapa pun yang mengirim pesan akan otomatis di-kick dan pesannya dibersihkan.",
              permissionOverwrites: [
                {
                  id: interaction.guild.roles.everyone.id,
                  deny: [PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads],
                  allow: [PermissionFlagsBits.SendMessages], // sengaja diizinkan agar jebakan bisa dipicu
                },
              ],
            });
          }

          setTrapChannelId(interaction.guild.id, trapChannel.id);

          // Kirim embed peringatan yang terlihat semua orang di dalam trap channel itu sendiri.
          await trapChannel
            .send({
              embeds: [
                baseEmbed("🪤 TRAP CHANNEL — JANGAN KIRIM PESAN", 0xff0000).setDescription(
                  "**Channel ini adalah jebakan anti-scammer.**\n\n" +
                    "⛔ **JANGAN kirim pesan apa pun di sini.**\n\n" +
                    "Siapa pun yang mengirim pesan di channel ini akan otomatis:\n" +
                    "• **di-kick** dari server, dan\n" +
                    "• **semua pesannya** di seluruh channel **dihapus**.\n\n" +
                    "Channel ini sengaja dibiarkan agar akun scammer / akun yang kena hack " +
                    "(yang biasanya nge-spam ke semua channel) langsung ketahuan dan ditendang.\n\n" +
                    "🙂 Kalau kamu member biasa: cukup abaikan channel ini."
                ),
              ],
            })
            .catch(() => {});

          await interaction.editReply({
            content:
              `🪤 **Trap channel aktif!**\n\n` +
              `Channel jebakan: <#${trapChannel.id}>\n` +
              `Siapa pun (selain admin dengan izin Manage Server) yang mengirim pesan di sana akan:\n` +
              `• langsung di-kick dari server, dan\n` +
              `• seluruh pesannya di semua channel dibersihkan.\n\n` +
              `⚠️ Beri tahu member: **jangan pernah kirim pesan di channel ini.**`,
          });

          await sendLog(
            interaction.guild,
            baseEmbed("🪤 Trap Channel Di-set", 0xff0000).addFields(
              { name: "Diatur Oleh", value: `${interaction.user.username} (${interaction.user.id})` },
              { name: "Trap Channel", value: `<#${trapChannel.id}>` }
            )
          );
        } catch (err) {
          console.error("Gagal set trap channel:", err);
          await interaction.editReply({
            content:
              "❌ Gagal mengatur trap channel. Pastikan bot punya permission **Manage Channels**, lalu coba lagi.",
          });
        }
        return;
      }

      if (interaction.commandName === "status") {
        const logChannelId = getLogChannelId(interaction.guild.id);
        const trapChannelId = getTrapChannelId(interaction.guild.id);
        await interaction.reply({
          ephemeral: true,
          content: logChannelId
            ? `✅ Bot sudah aktif.\n📋 Channel log: <#${logChannelId}>\n🛡️ Anti-spam & anti-phishing: aktif\n🪤 Trap channel: ${
                trapChannelId ? `<#${trapChannelId}>` : "belum diatur (jalankan **/trap**)"
              }`
            : `⚠️ Bot belum di-setup di server ini. Jalankan **/setup** terlebih dahulu.`,
        });
      }
    });

    // --- Log events lain yang tidak perlu file event terpisah ---
    client.on("messageDelete", async (message) => {
      if (!message.guild || message.author?.bot) return;
      await sendLog(
        message.guild,
        baseEmbed("🗑️ Pesan Dihapus", 0x999999).addFields(
          { name: "User", value: `${message.author?.username ?? "Tidak diketahui"}` },
          { name: "Channel", value: `<#${message.channel.id}>` },
          { name: "Isi Pesan", value: message.content?.slice(0, 1000) || "*(tidak ada teks / embed / attachment)*" }
        )
      );
    });

    client.on("messageUpdate", async (oldMessage, newMessage) => {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (oldMessage.content === newMessage.content) return;

      await sendLog(
        newMessage.guild,
        baseEmbed("✏️ Pesan Diedit", 0x3498db).addFields(
          { name: "User", value: `${newMessage.author?.username ?? "Tidak diketahui"}` },
          { name: "Channel", value: `<#${newMessage.channel.id}>` },
          { name: "Sebelum", value: oldMessage.content?.slice(0, 500) || "-" },
          { name: "Sesudah", value: newMessage.content?.slice(0, 500) || "-" }
        )
      );
    });

    client.on("guildMemberRemove", async (member) => {
      await sendLog(
        member.guild,
        baseEmbed("📤 Member Keluar/Dikick", 0xe74c3c).addFields({
          name: "User",
          value: `${member.user.username} (${member.id})`,
        })
      );
    });

    client.on("guildBanAdd", async (ban) => {
      await sendLog(
        ban.guild,
        baseEmbed("🔨 User Di-Ban", 0x992d22).addFields({
          name: "User",
          value: `${ban.user.username} (${ban.user.id})`,
        })
      );
    });

    client.on("voiceStateUpdate", async (oldState, newState) => {
      const member = newState.member ?? oldState.member;
      if (!member || member.user.bot) return;
      const guild = newState.guild;

      const oldChannel = oldState.channel;
      const newChannel = newState.channel;

      if (oldChannel?.id === newChannel?.id) return;

      if (!oldChannel && newChannel) {
        await sendLog(
          guild,
          baseEmbed("🔊 Bergabung ke Voice Channel", 0x2ecc71).addFields(
            { name: "User", value: `${member.user.username} (${member.id})` },
            { name: "Channel", value: `${newChannel.name}` }
          )
        );
        return;
      }

      if (oldChannel && !newChannel) {
        let disconnectedBy = null;
        try {
          const auditLogs = await guild.fetchAuditLogs({
            type: 28, // AuditLogEvent.MemberDisconnect
            limit: 5,
          });
          const entry = auditLogs.entries.find(
            (e) => Date.now() - e.createdTimestamp < 5000
          );
          if (entry) disconnectedBy = entry.executor;
        } catch (err) {
          console.error("Gagal fetch audit log voice disconnect:", err);
        }

        const embed = baseEmbed(
          disconnectedBy ? "🔇 Member Diputus Paksa dari Voice" : "🔇 Keluar dari Voice Channel",
          0xe74c3c
        ).addFields(
          { name: "Member", value: `${member.user.username} (${member.id})` },
          { name: "Channel", value: `${oldChannel.name}` }
        );
        if (disconnectedBy) {
          embed.addFields({ name: "Diputus Oleh", value: `${disconnectedBy.username} (${disconnectedBy.id})` });
        }

        await sendLog(guild, embed);
        return;
      }

      if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        // Cek audit log untuk tahu apakah ini dipindahkan oleh admin/moderator (bukan pindah sendiri).
        // Beri jeda singkat: event voice bisa datang sebelum entri audit log tercatat Discord.
        await new Promise((r) => setTimeout(r, 700));

        let movedBy = null;
        try {
          const auditLogs = await guild.fetchAuditLogs({
            type: 27, // AuditLogEvent.MemberMove
            limit: 5,
          });
          // Discord me-reuse entri MemberMove (menambah count) untuk pemindahan beruntun ke
          // channel yang sama, jadi timestamp bisa lawas. Pakai window lebih longgar (10 dtk)
          // dan cocokkan channel tujuan.
          const entry = auditLogs.entries.find(
            (e) =>
              Date.now() - e.createdTimestamp < 10000 &&
              e.extra?.channel?.id === newChannel.id
          );
          if (entry) movedBy = entry.executor;
        } catch (err) {
          console.error("Gagal fetch audit log voice move:", err);
        }

        const embed = baseEmbed(
          movedBy ? "🔀 Member Dipindahkan Voice Channel" : "➡️ Pindah Voice Channel",
          0x3498db
        ).addFields(
          { name: "Member", value: `${member.user.username} (${member.id})` },
          { name: "Dari", value: `${oldChannel.name}` },
          { name: "Ke", value: `${newChannel.name}` }
        );

        if (movedBy) {
          embed.addFields({ name: "Dipindahkan Oleh", value: `${movedBy.username} (${movedBy.id})` });
        }

        await sendLog(guild, embed);
      }
    });
  },
};
