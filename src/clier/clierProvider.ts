import * as vscode from 'vscode';
import * as path from 'path';
import { execCommand } from '../utils/exec';
import { getWorkspaceFolder } from '../utils/workspace';
import { parseClierStatus, loadPipelineConfig } from './clierParser';
import { ClierHeaderItem, DaemonItem, ProcessItem, StageItem } from './clierItems';
import { InstallItem } from '../common/installItem';
import { ClierPipelineItem, ClierStatusOutput, ClierStageInfo, ClierPipelineConfig } from '../types';

export type ClierTreeItem = ClierHeaderItem | DaemonItem | StageItem | ProcessItem | InstallItem;

export class ClierProvider implements vscode.TreeDataProvider<ClierTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ClierTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private pollingInterval: ReturnType<typeof setInterval> | undefined;
  private pipelineConfig: ClierPipelineConfig = { stages: [], processes: [], stageNames: new Set() };
  private clierMissing = false;
  private cachedStatus: ClierStatusOutput | undefined;
  private clierVersion: string = '';

  private _clierInstalled = true;

  constructor(private workspaceState: vscode.Memento) {}

  set clierInstalled(value: boolean) {
    this._clierInstalled = value;
    this.clierMissing = !value;
    this.refresh();
  }

  private getHiddenSet(): Set<string> {
    return new Set(this.workspaceState.get<string[]>('workflow.hiddenProcesses', []));
  }

  private isShowingHidden(): boolean {
    return this.workspaceState.get<boolean>('workflow.showHiddenProcesses', false);
  }

  async hideProcess(name: string): Promise<void> {
    const hidden = this.workspaceState.get<string[]>('workflow.hiddenProcesses', []);
    if (!hidden.includes(name)) {
      hidden.push(name);
      await this.workspaceState.update('workflow.hiddenProcesses', hidden);
    }
    this.refresh();
  }

  async unhideProcess(name: string): Promise<void> {
    const hidden = this.workspaceState.get<string[]>('workflow.hiddenProcesses', []);
    const filtered = hidden.filter((n) => n !== name);
    await this.workspaceState.update('workflow.hiddenProcesses', filtered);
    this.refresh();
  }

  async toggleShowHidden(): Promise<void> {
    const current = this.isShowingHidden();
    await this.workspaceState.update('workflow.showHiddenProcesses', !current);
    vscode.commands.executeCommand('setContext', 'workflowShowHiddenProcesses', !current);
    this.refresh();
  }

  refresh(): void {
    this.cachedStatus = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ClierTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ClierTreeItem): Promise<ClierTreeItem[]> {
    if (!this._clierInstalled) {
      vscode.commands.executeCommand('setContext', 'workflowClierHasContent', false);
      return [new InstallItem('Clier', 'npm install -g clier-ai')];
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
      vscode.commands.executeCommand('setContext', 'workflowClierHasContent', false);
      return [];
    }

    // Load pipeline config on each refresh to pick up changes
    this.loadConfig(folder);

    const hasContent = this.pipelineConfig.stages.length > 0 || this.pipelineConfig.processes.length > 0;
    vscode.commands.executeCommand('setContext', 'workflowClierHasContent', hasContent);

    // If element is a stage, return its processes
    if (element instanceof StageItem) {
      const hidden = this.getHiddenSet();
      const showHidden = this.isShowingHidden();
      return element.stage.processes
        .filter((p) => showHidden || !hidden.has(p.name))
        .map((p) => new ProcessItem(p, this.findConfigItem(p.name), hidden.has(p.name)));
    }

    // For root level, fetch status and return daemon + stages + ungrouped processes
    if (!element) {
      return this.getRootChildren(folder);
    }

    return [];
  }

  private findConfigItem(name: string): ClierPipelineItem | undefined {
    // Search in stage processes first
    for (const stage of this.pipelineConfig.stages) {
      const found = stage.processes.find((p) => p.name === name);
      if (found) return found;
    }
    // Then search top-level processes
    return this.pipelineConfig.processes.find((p) => p.name === name);
  }

  private async fetchClierVersion(folder: string): Promise<void> {
    if (this.clierVersion) return;
    try {
      const result = await execCommand('clier', ['--version'], folder);
      if (result.exitCode === 0) {
        this.clierVersion = result.stdout.trim();
      }
    } catch {
      // Version fetch failed, leave empty
    }
  }

  private async getRootChildren(folder: string): Promise<ClierTreeItem[]> {
    try {
      await this.fetchClierVersion(folder);
      const result = await execCommand('clier', ['status', '--json'], folder);
      this.clierMissing = false;
      const status = parseClierStatus(result.stdout);
      this.cachedStatus = status;

      const items: ClierTreeItem[] = [];
      items.push(new ClierHeaderItem(this.clierVersion));
      items.push(new DaemonItem(status.daemon));

      if (status.daemon.running) {
        // Build a map of status processes by stage for quick lookup
        const statusProcessesByStage = new Map<string, Set<string>>();
        for (const stage of status.stages) {
          statusProcessesByStage.set(stage.name, new Set(stage.processes.map((p) => p.name)));
        }

        // Process all config stages, merging with status data
        for (const configStage of this.pipelineConfig.stages) {
          const statusStage = status.stages.find((s) => s.name === configStage.name);
          const statusProcessNames = statusProcessesByStage.get(configStage.name) || new Set();

          const mergedProcesses: ClierStageInfo['processes'] = [];

          // Add running processes from status
          if (statusStage) {
            for (const proc of statusStage.processes) {
              const configItem = this.findConfigItem(proc.name);
              if (configItem) {
                proc.type = configItem.type;
              }
              mergedProcesses.push(proc);
            }
          }

          // Add stopped processes from config that aren't in status
          for (const configProc of configStage.processes) {
            if (!statusProcessNames.has(configProc.name)) {
              mergedProcesses.push({
                name: configProc.name,
                status: 'stopped',
                pid: '',
                uptime: '',
                restarts: '0',
                type: configProc.type,
                stage: configStage.name,
              });
            }
          }

          items.push(new StageItem({ name: configStage.name, processes: mergedProcesses }));
        }

        // Add ungrouped processes from status
        const hidden = this.getHiddenSet();
        const showHidden = this.isShowingHidden();
        for (const proc of status.processes) {
          const configItem = this.findConfigItem(proc.name);
          if (configItem) {
            proc.type = configItem.type;
          }
          const isHidden = hidden.has(proc.name);
          if (isHidden && !showHidden) continue;
          items.push(new ProcessItem(proc, configItem, isHidden));
        }

        // Add any config processes not in status as stopped
        const allStatusProcesses = new Set([
          ...status.processes.map((p) => p.name),
          ...status.stages.flatMap((s) => s.processes.map((p) => p.name)),
        ]);
        for (const configItem of this.pipelineConfig.processes) {
          if (!allStatusProcesses.has(configItem.name)) {
            const isHidden = hidden.has(configItem.name);
            if (isHidden && !showHidden) continue;
            items.push(
              new ProcessItem(
                {
                  name: configItem.name,
                  status: 'stopped',
                  pid: '',
                  uptime: '',
                  restarts: '0',
                  type: configItem.type,
                },
                configItem,
                isHidden
              )
            );
          }
        }
      } else {
        // Daemon not running — show all config stages and processes as stopped
        const hidden = this.getHiddenSet();
        const showHidden = this.isShowingHidden();
        for (const configStage of this.pipelineConfig.stages) {
          const stoppedStage: ClierStageInfo = {
            name: configStage.name,
            processes: configStage.processes.map((p) => ({
              name: p.name,
              status: 'stopped' as const,
              pid: '',
              uptime: '',
              restarts: '0',
              type: p.type,
              stage: configStage.name,
            })),
          };
          items.push(new StageItem(stoppedStage));
        }

        for (const configItem of this.pipelineConfig.processes) {
          const isHidden = hidden.has(configItem.name);
          if (isHidden && !showHidden) continue;
          items.push(
            new ProcessItem(
              {
                name: configItem.name,
                status: 'stopped',
                pid: '',
                uptime: '',
                restarts: '0',
                type: configItem.type,
              },
              configItem,
              isHidden
            )
          );
        }
      }

      return items;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ENOENT')) {
        this.clierMissing = true;
        vscode.window.showWarningMessage('clier binary not found on PATH. Install clier to use Pipeline view.');
      }
      return this.buildStoppedItems();
    }
  }

  private buildStoppedItems(): ClierTreeItem[] {
    const items: ClierTreeItem[] = [];
    items.push(new ClierHeaderItem(this.clierVersion));
    items.push(new DaemonItem({ running: false, pid: '', uptime: '', configPath: '' }));

    const hidden = this.getHiddenSet();
    const showHidden = this.isShowingHidden();

    for (const configStage of this.pipelineConfig.stages) {
      const stoppedStage: ClierStageInfo = {
        name: configStage.name,
        processes: configStage.processes.map((p) => ({
          name: p.name,
          status: 'stopped' as const,
          pid: '',
          uptime: '',
          restarts: '0',
          type: p.type,
          stage: configStage.name,
        })),
      };
      items.push(new StageItem(stoppedStage));
    }

    for (const configItem of this.pipelineConfig.processes) {
      const isHidden = hidden.has(configItem.name);
      if (isHidden && !showHidden) continue;
      items.push(
        new ProcessItem(
          {
            name: configItem.name,
            status: 'stopped',
            pid: '',
            uptime: '',
            restarts: '0',
            type: configItem.type,
          },
          configItem,
          isHidden
        )
      );
    }
    return items;
  }

  private loadConfig(folder: string): void {
    const configPath = path.join(folder, 'clier-pipeline.json');
    this.pipelineConfig = loadPipelineConfig(configPath);
  }

  startPolling(treeView: vscode.TreeView<ClierTreeItem>): vscode.Disposable {
    const updatePolling = (visible: boolean) => {
      if (visible) {
        if (!this.pollingInterval) {
          this.pollingInterval = setInterval(() => this.refresh(), 5000);
        }
      } else {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = undefined;
        }
      }
    };

    // Start polling if view is already visible
    updatePolling(treeView.visible);

    const visibilityDisposable = treeView.onDidChangeVisibility((e) => {
      updatePolling(e.visible);
    });

    return {
      dispose: () => {
        visibilityDisposable.dispose();
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = undefined;
        }
      },
    };
  }

  dispose(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this._onDidChangeTreeData.dispose();
  }
}
