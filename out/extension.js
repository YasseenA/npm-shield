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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auditRunner_1 = require("./auditRunner");
const diagnosticsManager_1 = require("./diagnosticsManager");
const dashboard_1 = require("./dashboard");
const statusBar_1 = require("./statusBar");
function activate(context) {
    console.log('NPM Shield activating...');
    const diagnostics = new diagnosticsManager_1.DiagnosticsManager(context);
    const auditor = new auditRunner_1.AuditRunner(context, diagnostics);
    const statusBar = new statusBar_1.StatusBarController(context, auditor);
    // ── Commands ──────────────────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('npmShield.scan', async () => {
        await auditor.runAudit();
    }), vscode.commands.registerCommand('npmShield.showDashboard', () => {
        dashboard_1.DashboardPanel.show(context, auditor);
    }), vscode.commands.registerCommand('npmShield.fixAll', async () => {
        await auditor.fixAll();
    }), vscode.commands.registerCommand('npmShield.scanOnSave', () => {
        const cfg = vscode.workspace.getConfiguration('npmShield');
        const current = cfg.get('scanOnSave', true);
        cfg.update('scanOnSave', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`NPM Shield: Scan on save ${!current ? 'enabled ✓' : 'disabled'}`);
    }), vscode.commands.registerCommand('npmShield.openTerminal', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        const terminal = vscode.window.createTerminal({
            name: 'NPM Audit',
            cwd: workspaceRoot
        });
        terminal.show();
        terminal.sendText('npm audit');
    }));
    // ── Auto-scan when package.json is saved ─────────────────────────────────
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
        if (doc.fileName.endsWith('package.json')) {
            const cfg = vscode.workspace.getConfiguration('npmShield');
            if (cfg.get('scanOnSave', true)) {
                await auditor.runAudit();
            }
        }
    }));
    // ── Auto-scan on startup if package.json exists ───────────────────────────
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (workspaceRoot) {
        if (fs.existsSync(path.join(workspaceRoot, 'package.json'))) {
            auditor.runAudit(true);
        }
    }
    statusBar.start();
    auditor.onResultsUpdated(() => {
        statusBar.update(auditor.lastResults);
        if (dashboard_1.DashboardPanel.currentPanel) {
            dashboard_1.DashboardPanel.currentPanel.update(auditor.lastResults);
        }
    });
    console.log('NPM Shield active.');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map