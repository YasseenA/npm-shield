import * as vscode from 'vscode';
import * as path from 'path';
import { AuditResults, Severity } from './auditRunner';

export class DiagnosticsManager {
  private _collection: vscode.DiagnosticCollection;

  constructor(context: vscode.ExtensionContext) {
    this._collection = vscode.languages.createDiagnosticCollection('npmShield');
    context.subscriptions.push(this._collection);
  }

  async updateDiagnostics(
    pkgPath: string,
    results: AuditResults,
    pkgJson: any
  ): Promise<void> {
    this._collection.clear();

    if (results.vulnerabilities.length === 0) return;

    const uri = vscode.Uri.file(pkgPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    const threshold = vscode.workspace.getConfiguration('npmShield')
      .get<Severity>('severityThreshold', 'moderate');
    const thresholdOrder = ['critical', 'high', 'moderate', 'low', 'info'];
    const thresholdIndex = thresholdOrder.indexOf(threshold);

    for (const vuln of results.vulnerabilities) {
      const vulnSeverityIndex = thresholdOrder.indexOf(vuln.severity);
      if (vulnSeverityIndex > thresholdIndex) continue;

      // Find the package name in package.json text
      const packageName = vuln.name;
      const searchStr = `"${packageName}"`;
      const index = text.indexOf(searchStr);
      if (index === -1) continue;

      const startPos = doc.positionAt(index);
      const endPos = doc.positionAt(index + searchStr.length);
      const range = new vscode.Range(startPos, endPos);

      const severity = this.mapSeverity(vuln.severity);
      const fixInfo = vuln.fixAvailable === true
        ? ' Fix available: run npm audit fix.'
        : typeof vuln.fixAvailable === 'object' && vuln.fixAvailable
          ? ` Fix available (major update to ${(vuln.fixAvailable as any).name}@${(vuln.fixAvailable as any).version}).`
          : ' No automatic fix available.';

      const message = [
        `[NPM Shield] ${vuln.severity.toUpperCase()} vulnerability in ${packageName}.`,
        vuln.description ? vuln.description : '',
        vuln.cvss ? `CVSS: ${vuln.cvss}.` : '',
        fixInfo,
        vuln.url ? `Details: ${vuln.url}` : ''
      ].filter(Boolean).join(' ');

      const diagnostic = new vscode.Diagnostic(range, message, severity);
      diagnostic.source = 'NPM Shield';
      diagnostic.code = vuln.url ? { value: vuln.severity, target: vscode.Uri.parse(vuln.url) } : vuln.severity;
      diagnostics.push(diagnostic);
    }

    this._collection.set(uri, diagnostics);
  }

  clear(): void {
    this._collection.clear();
  }

  private mapSeverity(severity: Severity): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
      case 'high':
        return vscode.DiagnosticSeverity.Error;
      case 'moderate':
        return vscode.DiagnosticSeverity.Warning;
      case 'low':
      case 'info':
        return vscode.DiagnosticSeverity.Information;
    }
  }
}
