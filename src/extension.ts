import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.commands.registerCommand('mql-vscode.compile', () => {
        const config = vscode.workspace.getConfiguration('mql-vscode');

        // Wine Path is mandatory for MacOS and Linux
        const winePath = os.platform() === 'win32' ? '' : config.get<string>('winePath');
        if ((os.platform() === 'darwin' || os.platform() === 'linux') && !winePath) {
            vscode.window.showErrorMessage('Wine path is not configured in the extension settings. Compilation cannot proceed without Wine on MacOS or Linux.');
            return;
        }

        // Get current file name and extension
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const filePath = editor.document.fileName;
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(fileName).slice(1);

        if (fileExtension !== 'mq4' && fileExtension !== 'mq5') {
            vscode.window.showErrorMessage('MQL compilation only supports .mq4 and .mq5 files');
            return;
        }

        // Get MetaEditor path as the compiler
        const compilerPath = fileExtension === 'mq4' ? config.get<string>('metaEditor4Path') : config.get<string>('metaEditor5Path');
        if (!compilerPath) {
            vscode.window.showErrorMessage(`MetaEditor ${fileExtension === 'mq4' ? '4' : '5'} path is not configured in the extension settings.`);
            return;
        }

        // Ensure temporary log file to receive compilation output
        const fileDir = path.dirname(filePath);
        const logFilePath = path.join(fileDir, 'mqlcompile.log');
        fs.writeFileSync(logFilePath, '', { flag: 'w' });

        // Construct the compilation command
        const command = `"${winePath}" "${compilerPath}" /compile:"${fileName}" /log:"mqlcompile.log"`.trim();

        const outputChannel = vscode.window.createOutputChannel('MQL');
        outputChannel.show();
        outputChannel.appendLine(`Compiling "${fileName}" inside "${fileDir}"...`);
        outputChannel.appendLine(`Command: ${command}`);

        cp.exec(command, { cwd: fileDir }, (_error, _stdout, _stderr) => {
            vscode.window.showInformationMessage('Compilation completed successfully. Check the log for details.');

            const logContent = fs.readFileSync(logFilePath, 'ucs-2');
            outputChannel.appendLine(logContent);

            fs.unlinkSync(logFilePath);
        });
    }));

}

export function deactivate() {}
