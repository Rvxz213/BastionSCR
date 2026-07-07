// utils/logger.js
const { EmbedBuilder } = require("discord.js");
const { getLogChannelId } = require("../config.js");

function baseEmbed(title, color = 0x5865f2) {
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
}

async function sendLog(guild, embed) {
  try {
    const logChannelId = getLogChannelId(guild.id);
    if (!logChannelId) return; // belum /setup di server ini
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) {
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Gagal mengirim log:", err);
  }
}

module.exports = { baseEmbed, sendLog };
