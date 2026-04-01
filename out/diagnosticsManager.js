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
exports.DiagnosticsManager = void 0;
const vscode = __importStar(require("vscode"));
class DiagnosticsManager {
    constructor(context) {
        this._collection = vscode.languages.createDiagnosticCollection('npmShield');
        context.subscriptions.push(this._collection);
    }
    async updateDiagnostics(pkgPath, results, pkgJson) {
        this._collection.clear();
        if (results.vulnerabilities.length === 0)
            return;
        const uri = vscode.Uri.file(pkgPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const text = doc.getText();
        const diagnostics = [];
        const threshold = vscode.workspace.getConfiguration('npmShield')
            .get('severityThreshold', 'moderate');
        const thresholdOrder = ['critical', 'high', 'moderate', 'low', 'info'];
        const thresholdIndex = thresholdOrder.indexOf(threshold);
        for (const vuln of results.vulnerabilities) {
            const vulnSeverityIndex = thresholdOrder.indexOf(vuln.severity);
            if (vulnSeverityIndex > thresholdIndex)
                continue;
            // Find the package name in package.json text
            const packageName = vuln.name;
            const searchStr = `"${packageName}"`;
            const index = text.indexOf(searchStr);
            if (index === -1)
                continue;
            const startPos = doc.positionAt(index);
            const endPos = doc.positionAt(index + searchStr.length);
            const range = new vscode.Range(startPos, endPos);
            const severity = this.mapSeverity(vuln.severity);
            const fixInfo = vuln.fixAvailable === true
                ? ' Fix available: run npm audit fix.'
                : typeof vuln.fixAvailable === 'object' && vuln.fixAvailable
                    ? ` Fix available (major update to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}).`
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
    clear() {
        this._collection.clear();
    }
    mapSeverity(severity) {
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
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=diagnosticsManager.js.map