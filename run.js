// run.js
// Wrapper: install dependency dulu (kalau belum ada), baru jalankan bot.
// Dipakai karena Startup Command di panel tidak mendukung "&&".

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const nodeModulesPath = path.join(__dirname, "node_modules");
const discordJsPath = path.join(nodeModulesPath, "discord.js");
const dotenvPath = path.join(nodeModulesPath, "dotenv");

const needsInstall = !fs.existsSync(discordJsPath) || !fs.existsSync(dotenvPath);

if (needsInstall) {
  console.log("📦 Dependency belum lengkap, menjalankan npm install...");
  try {
    execSync("npm install", { stdio: "inherit", cwd: __dirname });
    console.log("✅ npm install selesai.");
  } catch (err) {
    console.error("❌ Gagal menjalankan npm install:", err.message);
    process.exit(1);
  }
} else {
  console.log("✅ Dependency sudah lengkap, langsung start bot.");
}

// Jalankan bot utama
require("./index.js");
