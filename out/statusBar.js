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
exports.StatusBarController = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarController {
    constructor(context, auditor) {
        this.auditor = auditor;
        this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
        this._item.command = 'npmShield.showDashboard';
        this._item.tooltip = 'NPM Shield: Click to open security dashboard';
        this._scanItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 9);
        this._scanItem.command = 'npmShield.scan';
        this._scanItem.text = '$(shield) Scan';
        this._scanItem.tooltip = 'Run npm audit now';
        context.subscriptions.push(this._item, this._scanItem);
    }
    start() {
        this._item.text = '$(shield) NPM Shield';
        this._item.show();
        this._scanItem.show();
    }
    update(results) {
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
        }
        else if (critical > 0) {
            this._item.text = `$(error) ${critical} critical · ${total} total`;
            this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        else if (high > 0) {
            this._item.text = `$(warning) ${high} high · ${total} total`;
            this._item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this._item.text = `$(info) ${moderate} moderate · ${low} low`;
            this._item.backgroundColor = undefined;
        }
        if (results.lastScanned) {
            this._item.tooltip = `Last scanned: ${results.lastScanned.toLocaleTimeString()} — Click for details`;
        }
    }
}
exports.StatusBarController = StatusBarController;
//# sourceMappingURL=statusBar.js.map