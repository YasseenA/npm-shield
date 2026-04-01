import * as vscode from 'vscode';
import { AuditRunner, AuditResults } from './auditRunner';

export class StatusBarController {
  private _item: vscode.StatusBarItem;
  private _scanItem: vscode.StatusBarItem;

  constructor(
    context: vscode.ExtensionContext,
    private auditor: AuditRunner
  ) {
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    this._item.command = 'npmShield.showDashboard';
    this._item.tooltip = 'NPM Shield: Click to open security dashboard';

    this._scanItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 9);
    this._scanItem.command = 'npmShield.scan';
    this._scanItem.text = '$(shield) Scan';
    this._scanItem.tooltip = 'Run npm audit now';

    context.subscriptions.push(this._item, this._scanItem);
  }

  start(): void {
    this._item.text = '$(shield) NPM Shield';
    this._item.show();
    this._scanItem.show();
  }

  update(results: AuditResults): void {
    if (results.scanning) {
      this._item.text = '$(loading~spin) Scanning...';
      this._item.backgroundColor = undefined;
      return;
    }

    if (results.error) {
      this._item.text = '$(warning) NPM Shield: Error';
      this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      return;
    }

    const { critical, high, moderate, low, total } = results.summary;

    if (total === 0) {
      this._item.text = '$(shield) 0 vulnerabilities';
      this._item.backgroundColor = undefined;
    } else if (critical > 0) {
      this._item.text = `$(error) ${critical} critical · ${total} total`;
      this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (high > 0) {
      this._item.text = `$(warning) ${high} high · ${total} total`;
      this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this._item.text = `$(info) ${moderate} moderate · ${low} low`;
      this._item.backgroundColor = undefined;
    }

    if (results.lastScanned) {
      this._item.tooltip = `Last scanned: ${results.lastScanned.toLocaleTimeString()} — Click for details`;
    }
  }
}
