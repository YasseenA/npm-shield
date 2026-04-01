import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { DiagnosticsManager } from './diagnosticsManager';

const execAsync = promisify(exec);

export type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

export interface Vulnerability {
  name: string;
  severity: Severity;
  via: string[];
  range: string;
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
  cvss?: number;
  url?: string;
  description?: string;
}

export interface AuditResults {
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
  lastScanned: Date | null;
  packageCount: number;
  scanning: boolean;
  error: string | null;
  fixAvailableCount: number;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'moderate', 'low', 'info'];

export class AuditRunner {
  private _results: AuditResults = this.emptyResults();
  private _onResultsUpdated = new vscode.EventEmitter<AuditResults>();
  readonly onResultsUpdated = this._onResultsUpdated.event;

  constructor(
    private context: vscode.ExtensionContext,
    private diagnostics: DiagnosticsManager
  ) {}

  get lastResults(): AuditResults {
    return { ...this._results };
  }

  async runAudit(silent = false): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      if (!silent) vscode.window.showWarningMessage('NPM Shield: No workspace folder open.');
      return;
    }

    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      if (!silent) vscode.window.showWarningMessage('NPM Shield: No package.json found in workspace.');
      return;
    }

    // Check node_modules exists
    const nmPath = path.join(workspaceRoot, 'node_modules');
    if (!fs.existsSync(nmPath)) {
      if (!silent) {
        const action = await vscode.window.showWarningMessage(
          'NPM Shield: node_modules not found. Run npm install first?',
          'Run npm install', 'Cancel'
        );
        if (action === 'Run npm install') {
          await this.runNpmInstall(workspaceRoot);
        }
      }
      return;
    }

    this._results.scanning = true;
    this._results.error = null;
    this._onResultsUpdated.fire(this.lastResults);

    if (!silent) {
      vscode.window.setStatusBarMessage('$(shield) NPM Shield: Scanning...', 3000);
    }

    try {
      // Get package count
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const depCount = Object.keys(pkgJson.dependencies || {}).length +
                       Object.keys(pkgJson.devDependencies || {}).length;
      this._results.packageCount = depCount;

      // Run npm audit --json
      let auditOutput = '';
      try {
        const { stdout } = await execAsync('npm audit --json', {
          cwd: workspaceRoot,
          env: { ...process.env }
        });
        auditOutput = stdout;
      } catch (err: any) {
        // npm audit exits with non-zero when vulnerabilities found — that's expected
        auditOutput = err.stdout || '';
        if (!auditOutput) {
          throw new Error(`npm audit failed: ${err.message}`);
        }
      }

      const parsed = JSON.parse(auditOutput);
      this._results = this.parseAuditOutput(parsed, depCount);
      this._results.lastScanned = new Date();
      this._results.scanning = false;

      // Update diagnostics (inline warnings in package.json)
      const cfg = vscode.workspace.getConfiguration('npmShield');
      if (cfg.get<boolean>('showInlineWarnings', true)) {
        await this.diagnostics.updateDiagnostics(pkgPath, this._results, pkgJson);
      }

      this._onResultsUpdated.fire(this.lastResults);

      if (!silent) {
        const total = this._results.summary.total;
        const critical = this._results.summary.critical;
        const high = this._results.summary.high;

        if (total === 0) {
          vscode.window.showInformationMessage('✅ NPM Shield: No vulnerabilities found!');
        } else if (critical > 0 || high > 0) {
          vscode.window.showErrorMessage(
            `🚨 NPM Shield: ${total} vulnerabilities found (${critical} critical, ${high} high). Open dashboard for details.`,
            'Open Dashboard'
          ).then((choice: string | undefined) => {
            if (choice === 'Open Dashboard') {
              vscode.commands.executeCommand('npmShield.showDashboard');
            }
          });
        } else {
          vscode.window.showWarningMessage(
            `⚠️ NPM Shield: ${total} vulnerabilities found. Open dashboard for details.`,
            'Open Dashboard'
          ).then((choice: string | undefined) => {
            if (choice === 'Open Dashboard') {
              vscode.commands.executeCommand('npmShield.showDashboard');
            }
          });
        }
      }

    } catch (err: any) {
      this._results.scanning = false;
      this._results.error = err?.message || 'Unknown error running npm audit';
      this._onResultsUpdated.fire(this.lastResults);
      if (!silent) {
        vscode.window.showErrorMessage(`NPM Shield: ${this._results.error}`);
      }
    }
  }

  async fixAll(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return;

    const confirm = await vscode.window.showWarningMessage(
      'NPM Shield: Run npm audit fix? This will update packages to fix vulnerabilities.',
      { modal: true },
      'Run Fix', 'Cancel'
    );
    if (confirm !== 'Run Fix') return;

    const terminal = (vscode.window as any).createTerminal({
      name: 'NPM Shield: Fix',
      cwd: workspaceRoot
    });
    terminal.show();
    terminal.sendText('npm audit fix');

    setTimeout(() => this.runAudit(), 8000);
  }

  private parseAuditOutput(parsed: any, depCount: number): AuditResults {
    const vulns: Vulnerability[] = [];
    const summary = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };

    // npm audit v2 format (npm 7+)
    if (parsed.vulnerabilities) {
      for (const [name, data] of Object.entries(parsed.vulnerabilities as Record<string, any>)) {
        const severity = data.severity as Severity;
        const vuln: Vulnerability = {
          name,
          severity,
          via: Array.isArray(data.via)
            ? data.via.map((v: any) => typeof v === 'string' ? v : v.title || v.name || name)
            : [name],
          range: data.range || '*',
          fixAvailable: data.fixAvailable || false,
          cvss: data.via?.find?.((v: any) => v.cvss)?.cvss?.score,
          url: data.via?.find?.((v: any) => v.url)?.url,
          description: data.via?.find?.((v: any) => v.title)?.title
        };
        vulns.push(vuln);
        if (severity in summary) {
          (summary as any)[severity]++;
        }
        summary.total++;
      }
    }

    // Sort by severity
    vulns.sort((a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );

    const fixAvailableCount = vulns.filter(v =>
      v.fixAvailable === true ||
      (typeof v.fixAvailable === 'object' && v.fixAvailable !== null)
    ).length;

    return {
      vulnerabilities: vulns,
      summary,
      lastScanned: null,
      packageCount: depCount,
      scanning: false,
      error: null,
      fixAvailableCount
    };
  }

  private async runNpmInstall(cwd: string): Promise<void> {
    const terminal = (vscode.window as any).createTerminal({
      name: 'NPM Shield: Install',
      cwd
    });
    terminal.show();
    terminal.sendText('npm install');
  }

  private getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) return folders[0].uri.fsPath;
    return undefined;
  }

  private emptyResults(): AuditResults {
    return {
      vulnerabilities: [],
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      lastScanned: null,
      packageCount: 0,
      scanning: false,
      error: null,
      fixAvailableCount: 0
    };
  }
}
