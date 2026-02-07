export interface WorktreeInfo {
  path: string;
  branch: string;
  shortBranch: string;
  head: string;
  isBare: boolean;
  isMain: boolean;
  isDetached: boolean;
  isGwt: boolean;
  claudeRunning?: boolean;
  claudePid?: number | null;
  hasChanges?: boolean;
  diffStat?: string;
}

export interface GwtStatusWorktree {
  branch: string;
  path: string;
  head: string;
  isGwt: boolean;
  isMain: boolean;
  hasChanges: boolean;
  claudeRunning: boolean;
  claudePid: number | null;
}

export interface GwtStatusOutput {
  worktrees: GwtStatusWorktree[];
}

export interface GwtLaunchOptions {
  model?: string;
  maxBudgetUsd?: string;
  workOnly?: boolean;
  fromRef?: string;
}

export interface ClierProcessInfo {
  name: string;
  status: 'running' | 'stopped' | 'crashed' | 'restarting';
  pid: string;
  uptime: string;
  restarts: string;
  type: 'service' | 'task';
  stage?: string;
}

export interface ClierDaemonInfo {
  running: boolean;
  pid: string;
  uptime: string;
  configPath: string;
}

export interface ClierStageInfo {
  name: string;
  processes: ClierProcessInfo[];
}

export interface ClierStatusOutput {
  daemon: ClierDaemonInfo;
  stages: ClierStageInfo[];
  processes: ClierProcessInfo[];
}

export interface ClierPipelineItem {
  name: string;
  type: 'service' | 'task';
  command: string;
  manual: boolean;
  triggerOn: string[];
  stage?: string;
  inputEnabled: boolean;
}

export interface ClierPipelineStage {
  name: string;
  processes: ClierPipelineItem[];
}

export interface ClierPipelineConfig {
  stages: ClierPipelineStage[];
  processes: ClierPipelineItem[];
  stageNames: Set<string>;
}
