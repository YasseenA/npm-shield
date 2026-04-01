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
exports.AuditRunner = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];
class AuditRunner {
    constructor(context, diagnostics) {
        this.context = context;
        this.diagnostics = diagnostics;
        this._results = this.emptyResults();
        this._onResultsUpdated = new vscode.EventEmitter();
        this.onResultsUpdated = this._onResultsUpdated.event;
    }
    get lastResults() {
        return { ...this._results };
    }
    async runAudit(silent = false) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            if (!silent)
                vscode.window.showWarningMessage('NPM Shield: No workspace folder open.');
            return;
        }
        const pkgPath = path.join(workspaceRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            if (!silent)
                vscode.window.showWarningMessage('NPM Shield: No package.json found in workspace.');
            return;
        }
        // Check node_modules exists
        const nmPath = path.join(workspaceRoot, 'node_modules');
        if (!fs.existsSync(nmPath)) {
            if (!silent) {
                const action = await vscode.window.showWarningMessage('NPM Shield: node_modules not found. Run npm install first?', 'Run npm install', 'Cancel');
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
            }
            catch (err) {
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
            if (cfg.get('showInlineWarnings', true)) {
                await this.diagnostics.updateDiagnostics(pkgPath, this._results, pkgJson);
            }
            this._onResultsUpdated.fire(this.lastResults);
            if (!silent) {
                const total = this._results.summary.total;
                const critical = this._results.summary.critical;
                const high = this._results.summary.high;
                if (total === 0) {
                    vscode.window.showInformationMessage('✅ NPM Shield: No vulnerabilities found!');
                }
                else if (critical > 0 || high > 0) {
                    vscode.window.showErrorMessage(`🚨 NPM Shield: ${total} vulnerabilities found (${critical} critical, ${high} high). Open dashboard for details.`, 'Open Dashboard').then((choice) => {
                        if (choice === 'Open Dashboard') {
                            vscode.commands.executeCommand('npmShield.showDashboard');
                        }
                    });
                }
                else {
                    vscode.window.showWarningMessage(`⚠️ NPM Shield: ${total} vulnerabilities found. Open dashboard for details.`, 'Open Dashboard').then((choice) => {
                        if (choice === 'Open Dashboard') {
                            vscode.commands.executeCommand('npmShield.showDashboard');
                        }
                    });
                }
            }
        }
        catch (err) {
            this._results.scanning = false;
            this._results.error = err?.message || 'Unknown error running npm audit';
            this._onResultsUpdated.fire(this.lastResults);
            if (!silent) {
                vscode.window.showErrorMessage(`NPM Shield: ${this._results.error}`);
            }
        }
    }
    async fixAll() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return;
        const confirm = await vscode.window.showWarningMessage('NPM Shield: Run npm audit fix? This will update packages to fix vulnerabilities.', { modal: true }, 'Run Fix', 'Cancel');
        if (confirm !== 'Run Fix')
            return;
        const terminal = vscode.window.createTerminal({
            name: 'NPM Shield: Fix',
            cwd: workspaceRoot
        });
        terminal.show();
        terminal.sendText('npm audit fix');
        setTimeout(() => this.runAudit(), 8000);
    }
    parseAuditOutput(parsed, depCount) {
        const vulns = [];
        const summary = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
        // npm audit v2 format (npm 7+)
        if (parsed.vulnerabilities) {
            for (const [name, data] of Object.entries(parsed.vulnerabilities)) {
                const severity = data.severity;
                const vuln = {
                    name,
                    severity,
                    via: Array.isArray(data.via)
                        ? data.via.map((v) => typeof v === 'string' ? v : v.title || v.name || name)
                        : [name],
                    range: data.range || '*',
                    fixAvailable: data.fixAvailable || false,
                    cvss: data.via?.find?.((v) => v.cvss)?.cvss?.score,
                    url: data.via?.find?.((v) => v.url)?.url,
                    description: data.via?.find?.((v) => v.title)?.title
                };
                vulns.push(vuln);
                if (severity in summary) {
                    summary[severity]++;
                }
                summary.total++;
            }
        }
        // Sort by severity
        vulns.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
        const fixAvailableCount = vulns.filter(v => v.fixAvailable === true ||
            (typeof v.fixAvailable === 'object' && v.fixAvailable !== null)).length;
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
    async runNpmInstall(cwd) {
        const terminal = vscode.window.createTerminal({
            name: 'NPM Shield: Install',
            cwd
        });
        terminal.show();
        terminal.sendText('npm install');
    }
    getWorkspaceRoot() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0)
            return folders[0].uri.fsPath;
        return undefined;
    }
    emptyResults() {
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
exports.AuditRunner = AuditRunner;
//# sourceMappingURL=auditRunner.js.map