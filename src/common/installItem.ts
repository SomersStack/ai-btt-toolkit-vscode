import * as vscode from 'vscode';

export class InstallItem extends vscode.TreeItem {
  constructor(toolName: string, installCommand: string) {
    super(`Install ${toolName}`, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'install-item';
    this.iconPath = new vscode.ThemeIcon('cloud-download');
    this.description = 'click to install';
    this.tooltip = new vscode.MarkdownString(
      `**${toolName}** is not installed.\n\nClick to open a terminal running:\n\`\`\`\n${installCommand}\n\`\`\``
    );
    this.command = {
      command: 'workflow.openInstallTerminal',
      title: `Install ${toolName}`,
      arguments: [toolName, installCommand],
    };
  }
}
