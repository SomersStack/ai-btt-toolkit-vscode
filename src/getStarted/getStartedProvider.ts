import * as vscode from 'vscode';
import { GetStartedSectionItem, GetStartedStepItem, GetStartedGuideItem } from './getStartedItems';
import { InstallItem } from '../common/installItem';

export type GetStartedTreeItem = GetStartedSectionItem | GetStartedStepItem | GetStartedGuideItem | InstallItem;

export class GetStartedProvider implements vscode.TreeDataProvider<GetStartedTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GetStartedTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _gwtInstalled = false;
  private _clierInstalled = false;

  get gwtInstalled(): boolean {
    return this._gwtInstalled;
  }

  set gwtInstalled(value: boolean) {
    this._gwtInstalled = value;
    this.refresh();
  }

  get clierInstalled(): boolean {
    return this._clierInstalled;
  }

  set clierInstalled(value: boolean) {
    this._clierInstalled = value;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GetStartedTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GetStartedTreeItem): GetStartedTreeItem[] {
    if (element instanceof GetStartedSectionItem) {
      return element.children as GetStartedTreeItem[];
    }

    if (!element) {
      return [
        this.buildGwtSection(),
        this.buildClierSection(),
      ];
    }

    return [];
  }

  private buildGwtSection(): GetStartedSectionItem {
    const children: GetStartedTreeItem[] = [];

    if (!this._gwtInstalled) {
      children.push(new InstallItem('GWT', 'npm install -g ai-git-worktrees'));
      children.push(new GetStartedStepItem('Git Worktree manager for AI agent sessions', 'info'));
    } else {
      children.push(new GetStartedStepItem('1. Run gwt "your task" to create a worktree', 'play'));
      children.push(new GetStartedStepItem('2. Use gwt split to parallelise work', 'split-horizontal'));
      children.push(new GetStartedStepItem('3. Merge finished branches with gwt merge', 'git-merge'));
      children.push(new GetStartedGuideItem('View GWT Guide', 'workflow.getStarted.gwtReadme'));
    }

    return new GetStartedSectionItem('GWT - Git Worktrees', children);
  }

  private buildClierSection(): GetStartedSectionItem {
    const children: GetStartedTreeItem[] = [];

    if (!this._clierInstalled) {
      children.push(new InstallItem('Clier', 'npm install -g clier-ai'));
      children.push(new GetStartedStepItem('Process manager and pipeline runner', 'info'));
    } else {
      children.push(new GetStartedStepItem('1. Create clier-pipeline.json in your project', 'new-file'));
      children.push(new GetStartedStepItem('2. Run clier start to launch processes', 'play'));
      children.push(new GetStartedStepItem('3. Monitor status in the Pipeline view', 'eye'));
      children.push(new GetStartedGuideItem('View Clier Guide', 'workflow.getStarted.clierReadme'));
    }

    return new GetStartedSectionItem('Clier - Pipeline Runner', children);
  }
}
