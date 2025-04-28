import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { LogService } from './logService';

export const COMPILATION_LOG_FILE_NAME = 'mqlcompile.log';

export class CompilerSettings {
    public fileDir: string;
    public fileName: string;
    public fileExtension: string;
    public winePath: string;
    public compilerPath: string;
    public logFilePath: string;

    constructor(
        fileDir: string,
        fileName: string,
        fileExtension: string,
        winePath: string,
        compilerPath: string,
        logFilePath: string
    ) {
        this.fileDir = fileDir;
        this.fileName = fileName;
        this.fileExtension = fileExtension;
        this.winePath = winePath;
        this.compilerPath = compilerPath;
        this.logFilePath = logFilePath;
    }
}

export class CompilerService {
    private config: vscode.WorkspaceConfiguration;

    constructor(
        private logService: LogService
    ) {
        this.config = vscode.workspace.getConfiguration('VSCodeMQL');
    }

    public async compileCurrentFile(): Promise<void> {
        const filePath = this.getCurrentFilePath();
        if (!filePath) {
            return;
        }

        const settings = this.prepare(filePath);
        if (!settings) {
            return;
        }

        this.logService.show();
        this.logService.log(`Compiling "${settings.fileName}" in directory: "${settings.fileDir}"`);

        this.compile(settings).then(() => {
            if (!this.showCompilationLog(settings.logFilePath)) {
                return;
            }

            const shouldDeleteLog = !this.config.get<boolean>('retainCompilationLogFile');
            if (shouldDeleteLog) {
                this.cleanLogFile(settings.logFilePath);
            }
        });
    }

    private prepare(filePath: string): CompilerSettings | null {
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(fileName).slice(1);

        if (!this.validateFileExt(fileExtension)) {
            return null;
        }

        const winePath = this.getWinePath(os.platform());
        if (!this.validateWinePath(winePath)) {
            return null;
        }

        const compilerPath = this.getCompilerPath(fileExtension);
        if (!this.validateCompilerPath(compilerPath)) {
            return null;
        }

        const fileDir = path.dirname(filePath);
        const logFilePath = path.join(fileDir, COMPILATION_LOG_FILE_NAME);
        if (!this.prepareCompilationLog(logFilePath)) {
            return null;
        }

        return new CompilerSettings(fileDir, fileName, fileExtension, winePath, compilerPath, logFilePath);
    }

    private getCurrentFilePath(): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor window');
            return '';
        }
        return editor.document.fileName;
    }

    private validateFileExt(fileExtension: string): boolean {
        if (fileExtension !== 'mq4' && fileExtension !== 'mq5') {
            vscode.window.showErrorMessage('MQL compilation only supports .mq4 and .mq5 files');
            return false;
        }
        return true;
    }

    private getWinePath(osName: string): string {
        if (osName === 'darwin') {
            return this.config.get<string>('pathToWine') || '';
        } else if (osName === 'linux') {
            return this.config.get<string>('pathToWine') || '';
        }
        return '';
    }

    private validateWinePath(winePath: string): boolean {
        if (os.platform() !== 'darwin' && os.platform() !== 'linux') {
            return true;
        }

        if (!winePath) {
            vscode.window.showErrorMessage('Wine path is not configured in the extension settings. Compilation cannot proceed without Wine on macOS or Linux.');
            return false;
        }

        // Check if the Wine binary is readable and executable
        try {
            fs.accessSync(winePath, fs.constants.R_OK | fs.constants.X_OK);
            if (!fs.statSync(winePath).isFile()) {
                vscode.window.showErrorMessage('Wine path is not a valid file.');
                return false;
            }
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Wine path is not valid: ${error}`);
            return false;
        }
    }

    private getCompilerPath(fileExtension: string): string {
        const compilerPath = fileExtension === 'mq4' 
            ? this.config.get<string>('pathToMetaEditor4') 
            : this.config.get<string>('pathToMetaEditor5');
        return compilerPath || '';
    }

    private validateCompilerPath(compilerPath: string): boolean {
        if (!compilerPath) {
            vscode.window.showErrorMessage('MetaEditor path is not configured in the extension settings.');
            return false;
        }

        try {
            fs.accessSync(compilerPath, fs.constants.R_OK);
            if (!fs.statSync(compilerPath).isFile()) {
                vscode.window.showErrorMessage('MetaEditor path is not a valid file.');
                return false;
            }
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`MetaEditor path is not valid: ${error}`);
            return false;
        }
    }

    private prepareCompilationLog(logFilePath: string): boolean {
        try {
            fs.writeFileSync(logFilePath, '', { flag: 'w' });
            return true;
        } catch (error) {
            this.logService.error(`Error preparing log file: ${error}`);
            vscode.window.showErrorMessage(`Error preparing log file: ${error}`);
            return false;
        }
    }

    private async compile(settings: CompilerSettings): Promise<void> {
        const command = this.buildCompilationCommand(settings.winePath, settings.compilerPath, settings.fileName);
        return new Promise((resolve, _reject) => {
            // Wine + MetaEditor compile returns non-zero even on success.
            // Error and stderr do not show real compilation errors.
            // Just always resolve and check errors in the log file.
            cp.exec(command, { cwd: settings.fileDir }, (_error, _stdout, _stderr) => {
                vscode.window.showInformationMessage('Compilation completed. Check the log for details.');
                resolve();
            });
        });
    }

    private buildCompilationCommand(winePath: string, compilerPath: string, fileName: string): string {
        return `"${winePath}" "${compilerPath}" /compile:"${fileName}" /log:"${COMPILATION_LOG_FILE_NAME}"`.trim();
    }

    private showCompilationLog(logFilePath: string): boolean {
        try {
            const logContent = fs.readFileSync(logFilePath, 'ucs-2');
            this.logService.log(logContent.toString());
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading log file: ${error}`);
            return false;
        }
    }

    private cleanLogFile(logFilePath: string): boolean {
        try {
            fs.unlinkSync(logFilePath);
            return true;
        } catch (unlinkError) {
            vscode.window.showErrorMessage(`Error deleting log file: ${unlinkError}. Feel free to delete it manually.`);
            return false;
        }
    }
}
