import * as vscode from 'vscode';
import { CompilerService } from './services/compilerService';
import { LogService } from './services/logService';

export function activate(context: vscode.ExtensionContext) {
    const logService = new LogService('MQL');
    const compilerService = new CompilerService(logService);

    context.subscriptions.push(
        vscode.commands.registerCommand('mql-vscode.compile', () => { compilerService.compileCurrentFile(); })
    );
}

export function deactivate() {}
