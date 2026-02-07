import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execCommand } from './exec';

export function getWorkspaceFolder(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

export function hasGitRepo(folder: string): boolean {
  return fs.existsSync(path.join(folder, '.git'));
}

export function hasClierConfig(folder: string): boolean {
  return fs.existsSync(path.join(folder, 'clier-pipeline.json'));
}

export async function isCommandInstalled(command: string): Promise<boolean> {
  try {
    const result = await execCommand(command, ['--version'], process.cwd(), 5000);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
