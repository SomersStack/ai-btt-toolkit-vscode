import * as vscode from 'vscode';
import { WorktreeInfo } from '../types';

export class GwtHeaderItem extends vscode.TreeItem {
  constructor(public readonly version: string) {
    super('GWT', vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'gwt-header';
    this.iconPath = new vscode.ThemeIcon('git-branch');
    this.description = version || 'not found';

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**GWT CLI**\n\n`);
    md.appendMarkdown(`**Version:** ${version || 'not found'}\n\n`);
    this.tooltip = md;
  }
}

export class WorktreeItem extends vscode.TreeItem {
  constructor(
    public readonly worktree: WorktreeInfo,
    public readonly isHidden: boolean = false
  ) {
    const label = worktree.isMain
      ? `${worktree.shortBranch} (main)`
      : worktree.shortBranch;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = this.buildDescription();
    if (isHidden) {
      this.contextValue = 'worktreeHidden';
      this.iconPath = new vscode.ThemeIcon('eye-closed', new vscode.ThemeColor('disabledForeground'));
      this.description = `(hidden) ${this.description}`;
    } else {
      this.contextValue = worktree.isMain ? 'worktreeMain' : 'worktree';
      this.iconPath = this.getIcon();
    }
    this.tooltip = this.buildTooltip();
  }

  private buildDescription(): string {
    const parts: string[] = [];

    // Short commit hash
    parts.push(this.worktree.head.substring(0, 7));

    // Claude status
    if (this.worktree.claudeRunning) {
      parts.push('agent running');
    }

    // Diff stat summary
    if (this.worktree.diffStat) {
      // Extract just file count from "3 files changed, ..."
      const fileMatch = this.worktree.diffStat.match(/(\d+) files? changed/);
      if (fileMatch) {
        const insertMatch = this.worktree.diffStat.match(/(\d+) insertion/);
        const deleteMatch = this.worktree.diffStat.match(/(\d+) deletion/);
        const ins = insertMatch ? `+${insertMatch[1]}` : '';
        const del = deleteMatch ? `-${deleteMatch[1]}` : '';
        const stat = [ins, del].filter(Boolean).join(' ');
        parts.push(`${fileMatch[1]} files ${stat}`);
      }
    } else if (this.worktree.hasChanges) {
      parts.push('uncommitted changes');
    }

    return parts.join(' | ');
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.worktree.claudeRunning) {
      return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
    }
    if (this.worktree.isMain) {
      return new vscode.ThemeIcon('home');
    }
    if (this.worktree.isGwt) {
      return new vscode.ThemeIcon('git-branch');
    }
    return new vscode.ThemeIcon('source-control');
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Branch:** ${this.worktree.shortBranch}\n\n`);
    md.appendMarkdown(`**Path:** ${this.worktree.path}\n\n`);
    md.appendMarkdown(`**HEAD:** ${this.worktree.head}\n\n`);
    if (this.worktree.isGwt) {
      md.appendMarkdown(`**GWT:** Yes\n\n`);
    }
    if (this.worktree.isDetached) {
      md.appendMarkdown(`**Detached:** Yes\n\n`);
    }
    if (this.worktree.claudeRunning) {
      md.appendMarkdown(`**Claude Agent:** Running (PID: ${this.worktree.claudePid})\n\n`);
    }
    if (this.worktree.hasChanges) {
      md.appendMarkdown(`**Uncommitted Changes:** Yes\n\n`);
    }
    if (this.worktree.diffStat) {
      md.appendMarkdown(`**Diff:** ${this.worktree.diffStat}\n\n`);
    }
    return md;
  }
}
