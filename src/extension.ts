import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AuditRunner } from './auditRunner';
import { DiagnosticsManager } from './diagnosticsManager';
import { DashboardPanel } from './dashboard';
import { StatusBarController } from './statusBar';

export function activate(context: vscode.ExtensionContext) {
  console.log('NPM Shield activating...');

  const diagnostics = new DiagnosticsManager(context);
  const auditor = new AuditRunner(context, diagnostics);
  const statusBar = new StatusBarController(context, auditor);

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('npmShield.scan', async () => {
      await auditor.runAudit();
    }),

    vscode.commands.registerCommand('npmShield.showDashboard', () => {
      DashboardPanel.show(context, auditor);
    }),

    vscode.commands.registerCommand('npmShield.fixAll', async () => {
      await auditor.fixAll();
    }),

    vscode.commands.registerCommand('npmShield.scanOnSave', () => {
      const cfg = vscode.workspace.getConfiguration('npmShield');
      const current = cfg.get<boolean>('scanOnSave', true);
      cfg.update('scanOnSave', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `NPM Shield: Scan on save ${!current ? 'enabled ✓' : 'disabled'}`
      );
    }),

    vscode.commands.registerCommand('npmShield.openTerminal', () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      const terminal = (vscode.window as any).createTerminal({
        name: 'NPM Audit',
        cwd: workspaceRoot
      });
      terminal.show();
      terminal.sendText('npm audit');
    })
  );

  // ── Auto-scan when package.json is saved ─────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc: vscode.TextDocument) => {
      if (doc.fileName.endsWith('package.json')) {
        const cfg = vscode.workspace.getConfiguration('npmShield');
        if (cfg.get<boolean>('scanOnSave', true)) {
          await auditor.runAudit();
        }
      }
    })
  );

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
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.update(auditor.lastResults);
    }
  });

  console.log('NPM Shield active.');
}

export function deactivate() {}
