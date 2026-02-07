import * as vscode from 'vscode';
import { ClierDaemonInfo, ClierProcessInfo, ClierPipelineItem, ClierStageInfo } from '../types';

export class ClierHeaderItem extends vscode.TreeItem {
  constructor(public readonly version: string) {
    super('Clier', vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'clier-header';
    this.iconPath = new vscode.ThemeIcon('server-process');
    this.description = version || 'not found';

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Clier CLI**\n\n`);
    md.appendMarkdown(`**Version:** ${version || 'not found'}\n\n`);
    this.tooltip = md;
  }
}

export class StageItem extends vscode.TreeItem {
  constructor(public readonly stage: ClierStageInfo) {
    super(stage.name, vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = 'stage';
    this.iconPath = new vscode.ThemeIcon('folder');

    const runningCount = stage.processes.filter((p) => p.status === 'running').length;
    const totalCount = stage.processes.length;
    this.description = `${runningCount}/${totalCount} running`;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Stage:** ${stage.name}\n\n`);
    md.appendMarkdown(`**Processes:** ${totalCount}\n\n`);
    md.appendMarkdown(`**Running:** ${runningCount}\n\n`);
    this.tooltip = md;
  }
}

export class DaemonItem extends vscode.TreeItem {
  constructor(public readonly daemon: ClierDaemonInfo) {
    super('Daemon', vscode.TreeItemCollapsibleState.None);

    this.contextValue = daemon.running ? 'daemon-running' : 'daemon-stopped';
    this.iconPath = daemon.running
      ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));

    if (daemon.running) {
      this.description = `running | PID ${daemon.pid} | ${daemon.uptime}`;
    } else {
      this.description = 'stopped';
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Daemon Status:** ${daemon.running ? 'Running' : 'Stopped'}\n\n`);
    if (daemon.running) {
      md.appendMarkdown(`**PID:** ${daemon.pid}\n\n`);
      md.appendMarkdown(`**Uptime:** ${daemon.uptime}\n\n`);
    }
    if (daemon.configPath) {
      md.appendMarkdown(`**Config:** ${daemon.configPath}\n\n`);
    }
    this.tooltip = md;
  }
}

export class ProcessItem extends vscode.TreeItem {
  constructor(
    public readonly process: ClierProcessInfo,
    public readonly pipelineItem?: ClierPipelineItem,
    public readonly isHidden: boolean = false
  ) {
    super(process.name, vscode.TreeItemCollapsibleState.None);

    const inputSuffix = pipelineItem?.inputEnabled ? '-input' : '';
    if (isHidden) {
      this.contextValue = `hiddenProcess-${process.status}${inputSuffix}`;
      this.iconPath = new vscode.ThemeIcon('eye-closed', new vscode.ThemeColor('disabledForeground'));
      this.description = `(hidden) ${buildDescription(process)}`;
    } else {
      this.contextValue = `process-${process.status}${inputSuffix}`;
      this.iconPath = getStatusIcon(process.status);
      this.description = buildDescription(process);
    }
    this.tooltip = buildTooltip(process, pipelineItem);
  }
}

function getStatusIcon(status: ClierProcessInfo['status']): vscode.ThemeIcon {
  switch (status) {
    case 'running':
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
    case 'stopped':
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('disabledForeground'));
    case 'crashed':
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));
    case 'restarting':
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

function buildDescription(process: ClierProcessInfo): string {
  const parts: string[] = [process.status];
  if (process.pid) {
    parts.push(`PID ${process.pid}`);
  }
  if (process.uptime) {
    parts.push(process.uptime);
  }
  if (process.restarts && process.restarts !== '0') {
    parts.push(`${process.restarts} restarts`);
  }
  return parts.join(' | ');
}

function buildTooltip(
  process: ClierProcessInfo,
  pipelineItem?: ClierPipelineItem
): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**Name:** ${process.name}\n\n`);
  md.appendMarkdown(`**Status:** ${process.status}\n\n`);
  md.appendMarkdown(`**Type:** ${pipelineItem?.type || process.type}\n\n`);
  if (process.pid) {
    md.appendMarkdown(`**PID:** ${process.pid}\n\n`);
  }
  if (process.uptime) {
    md.appendMarkdown(`**Uptime:** ${process.uptime}\n\n`);
  }
  md.appendMarkdown(`**Restarts:** ${process.restarts}\n\n`);
  if (pipelineItem) {
    if (pipelineItem.command) {
      md.appendMarkdown(`**Command:** \`${pipelineItem.command}\`\n\n`);
    }
    if (pipelineItem.manual) {
      md.appendMarkdown(`**Manual:** Yes\n\n`);
    }
    if (pipelineItem.triggerOn.length > 0) {
      md.appendMarkdown(`**Triggers:** ${pipelineItem.triggerOn.join(', ')}\n\n`);
    }
    if (pipelineItem.inputEnabled) {
      md.appendMarkdown(`**Input:** Enabled\n\n`);
    }
  }
  return md;
}
