# 🛡️ NPM Shield

[![Install in VS Code](https://img.shields.io/badge/Install-VS%20Code-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=YasseenAwadallah.npm-shield)

**Instantly scan your npm packages for vulnerabilities — right inside VS Code.**

NPM Shield runs `npm audit` automatically and shows you exactly which packages have security issues, how severe they are, and how to fix them — without ever leaving your editor.

---

## Features

### 🔍 Auto-scan on save
Every time you save `package.json`, NPM Shield automatically scans for vulnerabilities. No manual steps needed.

### 📊 Security Dashboard
A full breakdown of every vulnerability found — severity, CVSS score, affected version range, and a direct link to the security advisory.

### 🔴 Inline warnings
Red and yellow squiggles appear directly on vulnerable package names in your `package.json` — hover to see the full details.

### 🔧 One-click fix
Click "Run npm audit fix" in the dashboard to automatically patch all fixable vulnerabilities.

### 📈 Status bar
Your current vulnerability count is always visible at the bottom of VS Code — green for clean, red for critical.

---

## Usage

1. Open any project with a `package.json`
2. NPM Shield scans automatically on startup
3. Check the status bar at the bottom for your vulnerability count
4. Open the dashboard: `Ctrl+Shift+P` → **NPM Shield: Open Security Dashboard**
5. Run a manual scan: `Ctrl+Shift+P` → **NPM Shield: Scan for Vulnerabilities**

---

## Commands

| Command | Description |
|---------|-------------|
| `NPM Shield: Scan for Vulnerabilities` | Run a full npm audit scan |
| `NPM Shield: Open Security Dashboard` | Open the vulnerability dashboard |
| `NPM Shield: Auto-fix All Vulnerabilities` | Run npm audit fix |
| `NPM Shield: Toggle Scan on Save` | Enable/disable auto-scan on save |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `npmShield.scanOnSave` | `true` | Auto-scan when package.json is saved |
| `npmShield.showInlineWarnings` | `true` | Show squiggles in package.json |
| `npmShield.severityThreshold` | `moderate` | Minimum severity to report |

---

## Requirements

- Node.js and npm installed
- A project with `package.json` and `node_modules`

---

## License

MIT · [GitHub](https://github.com/YasseenA/npm-shield)