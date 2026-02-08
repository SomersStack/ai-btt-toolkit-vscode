import * as vscode from 'vscode';
import { execCommand } from '../utils/exec';
import { getWorkspaceFolder } from '../utils/workspace';
import { parseWorktreeList, sortWorktrees } from './worktreeParser';
import { GwtHeaderItem, WorktreeItem } from './worktreeItems';
import { InstallItem } from '../common/installItem';
import { WorktreeInfo, GwtStatusOutput } from '../types';

export type WorktreeTreeItem = GwtHeaderItem | WorktreeItem | InstallItem;

export class WorktreeProvider implements vscode.TreeDataProvider<WorktreeTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorktreeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private gwtVersion: string = '';
  private cachedItems: WorktreeTreeItem[] = [];
  private cacheKey: string = '';
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private fetching = false;
  private _gwtInstalled = true;

  constructor(private workspaceState: vscode.Memento) {}

  set gwtInstalled(value: boolean) {
    this._gwtInstalled = value;
    this.forceRefresh();
  }

  private getHiddenSet(): Set<string> {
    return new Set(this.workspaceState.get<string[]>('workflow.hiddenWorktrees', []));
  }

  private isShowingHidden(): boolean {
    return this.workspaceState.get<boolean>('workflow.showHiddenWorktrees', false);
  }

  async hideWorktree(branch: string): Promise<void> {
    const hidden = this.workspaceState.get<string[]>('workflow.hiddenWorktrees', []);
    if (!hidden.includes(branch)) {
      hidden.push(branch);
      await this.workspaceState.update('workflow.hiddenWorktrees', hidden);
    }
    this.forceRefresh();
  }

  async unhideWorktree(branch: string): Promise<void> {
    const hidden = this.workspaceState.get<string[]>('workflow.hiddenWorktrees', []);
    const filtered = hidden.filter((b) => b !== branch);
    await this.workspaceState.update('workflow.hiddenWorktrees', filtered);
    this.forceRefresh();
  }

  async toggleShowHidden(): Promise<void> {
    const current = this.isShowingHidden();
    await this.workspaceState.update('workflow.showHiddenWorktrees', !current);
    vscode.commands.executeCommand('setContext', 'workflowShowHiddenWorktrees', !current);
    this.forceRefresh();
  }

  forceRefresh(): void {
    this.cachedItems = [];
    this.cacheKey = '';
    this._onDidChangeTreeData.fire();
  }

  /**
   * Public refresh: debounces and fetches in the background.
   * Only fires the tree change event when the data actually differs.
   */
  refresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.backgroundRefresh();
    }, 300);
  }

  private async backgroundRefresh(): Promise<void> {
    if (this.fetching) return;
    this.fetching = true;
    try {
      const items = await this.fetchItems();
      const key = this.computeCacheKey(items);
      if (key !== this.cacheKey) {
        this.cachedItems = items;
        this.cacheKey = key;
        this._onDidChangeTreeData.fire();
      }
    } finally {
      this.fetching = false;
    }
  }

  getTreeItem(element: WorktreeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<WorktreeTreeItem[]> {
    if (!this._gwtInstalled) {
      vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', false);
      return [new InstallItem('GWT', 'npm install -g ai-git-worktrees')];
    }
    // If we already have cached items, return them immediately (no spinner).
    // The background refresh will update and re-fire only if data changes.
    if (this.cachedItems.length > 0) {
      return this.cachedItems;
    }
    // First load — fetch synchronously so the tree populates.
    const items = await this.fetchItems();
    this.cachedItems = items;
    this.cacheKey = this.computeCacheKey(items);
    return items;
  }

  private async fetchItems(): Promise<WorktreeTreeItem[]> {
    const folder = getWorkspaceFolder();
    if (!folder) {
      vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', false);
      return [];
    }

    await this.fetchGwtVersion(folder);

    try {
      const result = await execCommand('git', ['worktree', 'list', '--porcelain'], folder);
      if (result.exitCode !== 0) {
        vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', false);
        return [new GwtHeaderItem(this.gwtVersion)];
      }

      const worktrees = parseWorktreeList(result.stdout);

      // Fetch gwt status to enrich worktree data
      const status = await this.fetchGwtStatus(folder);

      // Enrich worktrees with status data and diff stats
      for (const wt of worktrees) {
        if (status) {
          const match = status.worktrees.find(
            (s) => s.branch === wt.shortBranch || s.path === wt.path
          );
          if (match) {
            wt.claudeRunning = match.claudeRunning;
            wt.claudePid = match.claudePid;
            wt.hasChanges = match.hasChanges;
          }
        }

        // Fetch diff stat for non-main worktrees
        if (!wt.isMain && wt.shortBranch) {
          wt.diffStat = await this.fetchDiffStat(folder, wt.shortBranch);
        }
      }

      const sorted = sortWorktrees(worktrees);
      const items: WorktreeTreeItem[] = [new GwtHeaderItem(this.gwtVersion)];
      const hidden = this.getHiddenSet();
      const showHidden = this.isShowingHidden();
      for (const wt of sorted) {
        const isHidden = hidden.has(wt.shortBranch);
        if (isHidden && !showHidden) continue;
        items.push(new WorktreeItem(wt, isHidden));
      }

      const hasNonMainWorktrees = items.some((item) => item instanceof WorktreeItem && !item.worktree.isMain);
      vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', hasNonMainWorktrees);

      return items;
    } catch {
      vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', false);
      return [new GwtHeaderItem(this.gwtVersion)];
    }
  }

  /**
   * Build a string key from the tree items so we can detect real changes.
   */
  private computeCacheKey(items: WorktreeTreeItem[]): string {
    const parts: string[] = [];
    for (const item of items) {
      if (item instanceof WorktreeItem) {
        const wt = item.worktree;
        parts.push(
          `${wt.shortBranch}|${wt.head}|${wt.claudeRunning ?? ''}|${wt.claudePid ?? ''}|${wt.hasChanges ?? ''}|${wt.diffStat ?? ''}`
        );
      } else if (item instanceof GwtHeaderItem) {
        parts.push(`header|${item.version}`);
      }
    }
    return parts.join('\n');
  }

  private async fetchGwtVersion(folder: string): Promise<void> {
    if (this.gwtVersion) return;
    try {
      const result = await execCommand('gwt', ['--version'], folder);
      if (result.exitCode === 0) {
        this.gwtVersion = result.stdout.trim();
      }
    } catch {
      // Version fetch failed, leave empty
    }
  }

  private async fetchGwtStatus(folder: string): Promise<GwtStatusOutput | null> {
    try {
      const result = await execCommand('gwt', ['status', '--json'], folder);
      if (result.exitCode === 0 && result.stdout.trim()) {
        return JSON.parse(result.stdout.trim());
      }
    } catch {
      // Status fetch failed
    }
    return null;
  }

  private async fetchDiffStat(folder: string, branch: string): Promise<string> {
    try {
      const result = await execCommand(
        'git',
        ['diff', '--stat', '--shortstat', `HEAD...${branch}`],
        folder
      );
      if (result.exitCode === 0 && result.stdout.trim()) {
        const lines = result.stdout.trim().split('\n');
        const summary = lines[lines.length - 1].trim();
        return summary;
      }
    } catch {
      // diff failed
    }
    return '';
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this._onDidChangeTreeData.dispose();
  }
}
