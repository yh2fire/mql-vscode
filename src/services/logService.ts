import * as vscode from 'vscode';

export class LogService {
    private outputChannel: vscode.OutputChannel;

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    public log(message: string): void {
        this.outputChannel.appendLine(message);
    }

    public error(message: string): void {
        this.outputChannel.appendLine(`[ERROR] ${message}`);
    }

    public show(): void {
        this.outputChannel.show();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
