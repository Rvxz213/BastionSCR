// events/guildMemberAdd.js
const { baseEmbed, sendLog } = require("../utils/logger.js");

module.exports = {
  name: "guildMemberAdd",
  once: false,
  async execute(member) {
    await sendLog(
      member.guild,
      baseEmbed("📥 Member Baru Bergabung", 0x2ecc71).addFields(
        { name: "User", value: `${member.user.username} (${member.id})` },
        { name: "Akun Dibuat", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
      )
    );
  },
};
