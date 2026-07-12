import fs from "fs";
import path from "path";

const BACKUPS_DIR = path.join(process.cwd(), "backups");
const EXCLUDE_LIST = [
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  "backups",
  "tsconfig.tsbuildinfo"
];

function makeBackup() {
  console.log("=== STARTING ROLLING BACKUP (MAX 3 BACKUPS) ===");

  // Ensure backups directory exists
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const b1 = path.join(BACKUPS_DIR, "backup_1");
  const b2 = path.join(BACKUPS_DIR, "backup_2");
  const b3 = path.join(BACKUPS_DIR, "backup_3");

  // 1. Rotate existing backups: b1 (oldest) -> b2 -> b3 (newest)
  // Delete b1 (oldest) if it exists
  if (fs.existsSync(b1)) {
    console.log("Removing oldest backup (backup_1)...");
    fs.rmSync(b1, { recursive: true, force: true });
  }

  // Shift b2 to b1
  if (fs.existsSync(b2)) {
    console.log("Shifting backup_2 to backup_1...");
    fs.renameSync(b2, b1);
  }

  // Shift b3 to b2
  if (fs.existsSync(b3)) {
    console.log("Shifting backup_3 to backup_2...");
    fs.renameSync(b3, b2);
  }

  // 2. Create the newest backup as backup_3
  console.log("Creating new backup at backup_3...");
  fs.mkdirSync(b3, { recursive: true });

  try {
    const items = fs.readdirSync(process.cwd());
    for (const item of items) {
      if (EXCLUDE_LIST.includes(item)) continue;

      const srcPath = path.join(process.cwd(), item);
      const destPath = path.join(b3, item);

      // Copy each non-excluded item recursively to bypass ERR_FS_CP_EINVAL
      fs.cpSync(srcPath, destPath, { recursive: true });
    }

    console.log("\n[SUCCESS] Backup created successfully in backups/backup_3!");
    console.log("Backups currently stored:");
    ["backup_1", "backup_2", "backup_3"].forEach(dir => {
      const exists = fs.existsSync(path.join(BACKUPS_DIR, dir));
      console.log(` - ${dir}: ${exists ? "Present" : "Empty"}`);
    });
  } catch (err) {
    console.error("[ERROR] Failed to complete backup copy operation:", err);
    process.exit(1);
  }
}

makeBackup();
