"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
class DashboardPanel {
    static show(context, auditor) {
        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            DashboardPanel.currentPanel.update(auditor.lastResults);
            return;
        }
        const panel = vscode.window.createWebviewPanel('npmShieldDashboard', 'NPM Shield Dashboard', vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
        DashboardPanel.currentPanel = new DashboardPanel(panel, context, auditor);
    }
    constructor(panel, context, auditor) {
        this._disposables = [];
        this._panel = panel;
        this.update(auditor.lastResults);
        this._disposables.push(auditor.onResultsUpdated(results => this.update(results)));
        panel.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'scan':
                    await vscode.commands.executeCommand('npmShield.scan');
                    break;
                case 'fixAll':
                    await vscode.commands.executeCommand('npmShield.fixAll');
                    break;
                case 'openTerminal':
                    await vscode.commands.executeCommand('npmShield.openTerminal');
                    break;
            }
        }, null, this._disposables);
        panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    update(results) {
        this._panel.webview.html = this.getHtml(results);
    }
    getHtml(results) {
        const { summary, vulnerabilities, lastScanned, packageCount, scanning, error, fixAvailableCount } = results;
        const severityColor = (s) => {
            switch (s) {
                case 'critical': return '#ef4444';
                case 'high': return '#f97316';
                case 'moderate': return '#eab308';
                case 'low': return '#22c55e';
                default: return '#71717a';
            }
        };
        const severityBg = (s) => {
            switch (s) {
                case 'critical': return '#ef444422';
                case 'high': return '#f9731622';
                case 'moderate': return '#eab30822';
                case 'low': return '#22c55e22';
                default: return '#71717a22';
            }
        };
        const vulnRows = vulnerabilities.map(v => `
      <div class="vuln-card" style="border-left: 3px solid ${severityColor(v.severity)}">
        <div class="vuln-header">
          <span class="vuln-name">${escapeHtml(v.name)}</span>
          <span class="badge" style="background:${severityBg(v.severity)};color:${severityColor(v.severity)}">
            ${v.severity.toUpperCase()}
          </span>
          ${v.cvss ? `<span class="cvss">CVSS ${v.cvss.toFixed(1)}</span>` : ''}
        </div>
        ${v.description ? `<div class="vuln-desc">${escapeHtml(v.description)}</div>` : ''}
        <div class="vuln-meta">
          <span>Range: <code>${escapeHtml(v.range)}</code></span>
          ${v.fixAvailable === true
            ? '<span class="fix-available">✅ Fix available</span>'
            : typeof v.fixAvailable === 'object' && v.fixAvailable
                ? `<span class="fix-major">⚠️ Fix (major update)</span>`
                : '<span class="fix-none">❌ No auto-fix</span>'}
          ${v.url ? `<a href="${escapeHtml(v.url)}" class="vuln-link">View advisory ↗</a>` : ''}
        </div>
        ${v.via.length > 0 && v.via[0] !== v.name
            ? `<div class="vuln-via">Via: ${v.via.map(x => `<code>${escapeHtml(x)}</code>`).join(', ')}</div>`
            : ''}
      </div>
    `).join('');
        const scoreColor = summary.total === 0 ? '#22c55e'
            : summary.critical > 0 ? '#ef4444'
                : summary.high > 0 ? '#f97316'
                    : '#eab308';
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NPM Shield</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border);
    --card: var(--vscode-sideBar-background);
    --muted: var(--vscode-descriptionForeground);
    --input-bg: var(--vscode-input-background);
    --accent: var(--vscode-button-background);
    --accent-fg: var(--vscode-button-foreground);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: 13px; background: var(--bg); color: var(--fg); padding: 16px; line-height: 1.5; }
  h2 { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .subtitle { color: var(--muted); font-size: 11px; }
  .score-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
  .score-card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 10px; text-align: center; }
  .score-num { font-size: 24px; font-weight: 700; }
  .score-label { font-size: 10px; color: var(--muted); text-transform: uppercase; margin-top: 2px; }
  .summary-bar { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .summary-stat { text-align: center; }
  .summary-stat .num { font-size: 18px; font-weight: 700; }
  .summary-stat .lbl { font-size: 11px; color: var(--muted); }
  .actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .btn { padding: 6px 14px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-family: var(--vscode-font-family); font-weight: 500; }
  .btn-primary { background: var(--accent); color: var(--accent-fg); }
  .btn-secondary { background: var(--input-bg); color: var(--fg); border: 1px solid var(--border); }
  .btn-danger { background: #ef444422; color: #ef4444; border: 1px solid #ef444433; }
  .btn:hover { opacity: 0.85; }
  .vuln-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .vuln-card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
  .vuln-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .vuln-name { font-weight: 600; font-size: 13px; }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
  .cvss { font-size: 11px; color: var(--muted); }
  .vuln-desc { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  .vuln-meta { display: flex; gap: 12px; font-size: 11px; flex-wrap: wrap; align-items: center; }
  .vuln-via { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .fix-available { color: #22c55e; }
  .fix-major { color: #eab308; }
  .fix-none { color: var(--muted); }
  .vuln-link { color: var(--vscode-textLink-foreground); text-decoration: none; }
  .vuln-link:hover { text-decoration: underline; }
  code { background: var(--input-bg); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 11px; }
  .empty { text-align: center; padding: 40px; color: var(--muted); background: var(--card); border-radius: 6px; border: 1px solid var(--border); }
  .empty .big { font-size: 32px; margin-bottom: 8px; }
  .scanning { text-align: center; padding: 40px; color: var(--muted); }
  .error-box { background: #ef444422; border: 1px solid #ef444444; border-radius: 6px; padding: 12px; color: #ef4444; margin-bottom: 16px; }
  .last-scan { font-size: 11px; color: var(--muted); }
  .filter-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .filter-btn { padding: 3px 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--input-bg); color: var(--fg); font-size: 11px; cursor: pointer; }
  .filter-btn.active { border-color: currentColor; }
  hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
</style>
</head>
<body>

<div class="header">
  <h1>🛡️ NPM Shield</h1>
  <div class="subtitle">
    ${packageCount} packages scanned
    ${lastScanned ? ` · Last scan: ${new Date(lastScanned).toLocaleTimeString()}` : ''}
  </div>
</div>

${error ? `<div class="error-box">⚠️ ${escapeHtml(error)}</div>` : ''}

${scanning ? `
<div class="scanning">
  <div>$(loading~spin) Scanning packages...</div>
</div>
` : `
<!-- Score row -->
<div class="score-row">
  <div class="score-card">
    <div class="score-num" style="color:#ef4444">${summary.critical}</div>
    <div class="score-label">Critical</div>
  </div>
  <div class="score-card">
    <div class="score-num" style="color:#f97316">${summary.high}</div>
    <div class="score-label">High</div>
  </div>
  <div class="score-card">
    <div class="score-num" style="color:#eab308">${summary.moderate}</div>
    <div class="score-label">Moderate</div>
  </div>
  <div class="score-card">
    <div class="score-num" style="color:#22c55e">${summary.low}</div>
    <div class="score-label">Low</div>
  </div>
  <div class="score-card">
    <div class="score-num" style="color:${scoreColor}">${summary.total}</div>
    <div class="score-label">Total</div>
  </div>
</div>

${fixAvailableCount > 0 ? `
<div style="background:#22c55e22;border:1px solid #22c55e44;border-radius:6px;padding:10px;margin-bottom:16px;font-size:12px;color:#22c55e">
  ✅ ${fixAvailableCount} vulnerabilit${fixAvailableCount === 1 ? 'y' : 'ies'} can be fixed automatically with <code>npm audit fix</code>
</div>` : ''}

<!-- Actions -->
<div class="actions">
  <button class="btn btn-primary" onclick="vscode.postMessage({command:'scan'})">🔍 Scan Now</button>
  ${fixAvailableCount > 0 ? `<button class="btn btn-danger" onclick="vscode.postMessage({command:'fixAll'})">🔧 Run npm audit fix</button>` : ''}
  <button class="btn btn-secondary" onclick="vscode.postMessage({command:'openTerminal'})">💻 Open Terminal</button>
</div>

<hr>

<!-- Vulnerability list -->
<h2>Vulnerabilities ${summary.total > 0 ? `(${summary.total})` : ''}</h2>

${vulnerabilities.length === 0 ? `
<div class="empty">
  <div class="big">✅</div>
  <div>No vulnerabilities found!</div>
  <div style="font-size:11px;margin-top:4px">Your packages look clean.</div>
</div>
` : `
<div class="vuln-list">
  ${vulnRows}
</div>
`}
`}

<script>
  const vscode = acquireVsCodeApi();
</script>
</body>
</html>`;
    }
    dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.DashboardPanel = DashboardPanel;
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
//# sourceMappingURL=dashboard.js.map