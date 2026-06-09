# Claude ↔ Cursor handoff — setup for Alan

## One-time: API key (required for hands-off)

1. Open [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)
2. Create / copy an API key
3. Edit:

   `C:\Users\alan\AppData\Local\claude-cursor-handoff\config.env`

   Replace `PASTE_YOUR_KEY_HERE` with your key.

Until this is done, the 15-minute task **polls only** (updates status file) but **does not answer** questions.

## What runs automatically

| Item | Detail |
|------|--------|
| **Task name** | `ClaudeCursorHandoff15Min` |
| **Interval** | Every 15 minutes |
| **Script** | `Run-HandoffCycle.ps1` |
| **Logs** | `%LOCALAPPDATA%\claude-cursor-handoff\logs\cycle.log` |

## Manual trigger (Cursor chat)

Say:

> **check claude**

Same inbox processing as the scheduled run.

## Re-run setup

```powershell
powershell -ExecutionPolicy Bypass -File "G:\Dropbox\alan ranger photography\Website Code\Chat AI Bot\scripts\claude-cursor-handoff\Setup-ClaudeCursorHandoff.ps1"
```

## Google Drive folders

- Inbox: `Claude shared resources\Claude Questions for Cursor\`
- Outbox: `Claude shared resources\Cursor Outputs for Claude\`
- Instructions for Claude: `Claude shared resources\CLAUDE-HANDOFF-INSTRUCTIONS-LATEST.md`
