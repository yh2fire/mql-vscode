import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { LogService } from './logService';

export class CompilerService {
    private config: vscode.WorkspaceConfiguration;

    constructor(
        private logService: LogService
    ) {
        this.config = vscode.workspace.getConfiguration('mql-vscode');
    }

    public async compileCurrentFile(): Promise<void> {
        // Get current editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor window');
            return;
        }

        // Get file information
        const filePath = editor.document.fileName;
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(fileName).slice(1);

        // Validate file type
        if (fileExtension !== 'mq4' && fileExtension !== 'mq5') {
            vscode.window.showErrorMessage('MQL compilation only supports .mq4 and .mq5 files');
            return;
        }

        // Validate environment configuration
        if (!this.validateEnvironment(fileExtension)) {
            return;
        }

        try {
            // Execute compilation
            await this.executeCompilation(filePath, fileName, fileExtension);
        } catch (error) {
            this.logService.error(`Error during compilation: ${error}`);
            vscode.window.showErrorMessage(`Compilation failed: ${error}`);
        }
    }

    private validateEnvironment(fileExtension: string): boolean {
        // Check Wine configuration (required for MacOS and Linux)
        const winePath = os.platform() === 'win32' ? '' : this.config.get<string>('winePath');
        if ((os.platform() === 'darwin' || os.platform() === 'linux') && !winePath) {
            vscode.window.showErrorMessage('Wine path is not configured in the extension settings. Compilation cannot proceed without Wine on MacOS or Linux.');
            return false;
        }

        // Check MetaEditor path
        const metaEditorSetting = fileExtension === 'mq4' ? 'metaEditor4Path' : 'metaEditor5Path';
        const compilerPath = this.config.get<string>(metaEditorSetting);
        if (!compilerPath) {
            vscode.window.showErrorMessage(`MetaEditor ${fileExtension === 'mq4' ? '4' : '5'} path is not configured in the extension settings.`);
            return false;
        }

        return true;
    }

    private async executeCompilation(filePath: string, fileName: string, fileExtension: string): Promise<void> {
        const fileDir = path.dirname(filePath);
        const logFilePath = path.join(fileDir, 'mqlcompile.log');
        const winePath = os.platform() === 'win32' ? '' : this.config.get<string>('winePath');
        const compilerPath = fileExtension === 'mq4' 
            ? this.config.get<string>('metaEditor4Path') 
            : this.config.get<string>('metaEditor5Path');

        // Prepare log file
        fs.writeFileSync(logFilePath, '', { flag: 'w' });

        // Construct compilation command
        const command = `"${winePath}" "${compilerPath}" /compile:"${fileName}" /log:"mqlcompile.log"`.trim();

        this.logService.show();
        this.logService.log(`Compiling "${fileName}" in directory: "${fileDir}"`);
        this.logService.log(`Command: ${command}`);

        // Execute compilation
        cp.exec(command, { cwd: fileDir }, (_error, _stdout, _stderr) => {
            // Read and display log
            try {
                const logContent = fs.readFileSync(logFilePath, 'ucs-2');
                this.logService.log(logContent.toString());

                vscode.window.showInformationMessage('Compilation completed. Check the log for details.');
            } catch (readError) {
                vscode.window.showErrorMessage(`Compilation completed, but error reading log file: ${readError}`);
            }

            // Clean up log file
            try {
                fs.unlinkSync(logFilePath);
            } catch (unlinkError) {
                vscode.window.showErrorMessage(`Error deleting log file: ${unlinkError}. Feel free to delete it manually.`);
            }
        });
    }
}
