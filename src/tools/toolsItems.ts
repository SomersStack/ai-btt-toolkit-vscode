import * as vscode from 'vscode';

export class ToolItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    commandId: string,
    icon: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command: commandId,
      title: label,
    };
  }
}
