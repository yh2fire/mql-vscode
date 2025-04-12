import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.commands.registerCommand('mql-vscode.compile', () => {
        vscode.window.showInformationMessage('MQL Compile');
    }));

}

export function deactivate() {}
