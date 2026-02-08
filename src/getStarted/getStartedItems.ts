import * as vscode from 'vscode';

export class GetStartedSectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: vscode.TreeItem[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'getStarted-section';
  }
}

export class GetStartedStepItem extends vscode.TreeItem {
  constructor(label: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'getStarted-step';
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

export class GetStartedGuideItem extends vscode.TreeItem {
  constructor(label: string, commandId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'getStarted-guide';
    this.iconPath = new vscode.ThemeIcon('book');
    this.command = {
      command: commandId,
      title: label,
    };
  }
}
