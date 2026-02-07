import * as vscode from 'vscode';
import { ToolItem } from './toolsItems';

export class ToolsProvider implements vscode.TreeDataProvider<ToolItem> {
  getTreeItem(element: ToolItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolItem[] {
    return [
      new ToolItem(
        'Categorise & Commit',
        'Claude',
        'workflow.tools.claude.commitSession',
        'git-commit'
      ),
      new ToolItem(
        'Interactive Session',
        'Claude',
        'workflow.tools.claude.interactiveSession',
        'comment-discussion'
      ),
      new ToolItem(
        'YOLO Mode',
        'Claude',
        'workflow.tools.claude.yoloSession',
        'zap'
      ),
    ];
  }
}
