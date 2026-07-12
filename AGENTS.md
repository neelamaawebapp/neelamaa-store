<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Backup Retention Policy
Keep exactly the last 3 backup points inside the `backups/` directory (backup_1, backup_2, backup_3). Whenever a new backup is made, rotate them in a first-in-first-out manner so the oldest backup is overwritten.
