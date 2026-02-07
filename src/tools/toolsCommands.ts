import * as vscode from 'vscode';
import { getWorkspaceFolder } from '../utils/workspace';

export function registerToolsCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.tools.claude.commitSession', () => {
      const folder = getWorkspaceFolder();
      const terminal = vscode.window.createTerminal({
        name: 'Claude: Commit',
        cwd: folder || undefined,
      });
      terminal.show();
      terminal.sendText('claude "Categorise and commit the changes in this repo"');
    }),

    vscode.commands.registerCommand('workflow.tools.claude.interactiveSession', () => {
      const folder = getWorkspaceFolder();
      const terminal = vscode.window.createTerminal({
        name: 'Claude: Interactive',
        cwd: folder || undefined,
      });
      terminal.show();
      terminal.sendText('claude');
    }),

    vscode.commands.registerCommand('workflow.tools.claude.yoloSession', () => {
      const folder = getWorkspaceFolder();
      const terminal = vscode.window.createTerminal({
        name: 'Claude: YOLO',
        cwd: folder || undefined,
      });
      terminal.show();
      terminal.sendText('claude --dangerously-skip-permissions');
    })
  );
}
