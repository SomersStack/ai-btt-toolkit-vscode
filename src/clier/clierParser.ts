import * as fs from 'fs';
import { ClierProcessInfo, ClierDaemonInfo, ClierPipelineItem, ClierStatusOutput, ClierStageInfo, ClierPipelineConfig, ClierPipelineStage } from '../types';

interface ClierJsonDaemon {
  running: boolean;
  pid?: number;
  uptime?: string;
  config?: string;
}

interface ClierJsonProcess {
  name: string;
  type?: 'service' | 'task';
  status: string;
  pid?: number;
  uptime?: string;
  restarts?: number;
}

interface ClierJsonStage {
  name: string;
  processes: ClierJsonProcess[];
}

interface ClierJsonOutput {
  daemon: ClierJsonDaemon;
  stages?: ClierJsonStage[];
  processes?: ClierJsonProcess[];
}

function normalizeStatus(status: string): ClierProcessInfo['status'] {
  const s = status.toLowerCase();
  if (['running', 'stopped', 'crashed', 'restarting'].includes(s)) {
    return s as ClierProcessInfo['status'];
  }
  return 'stopped';
}

function parseJsonProcess(proc: ClierJsonProcess, stageName?: string): ClierProcessInfo {
  return {
    name: proc.name,
    status: normalizeStatus(proc.status),
    pid: proc.pid?.toString() || '',
    uptime: proc.uptime || '',
    restarts: proc.restarts?.toString() || '0',
    type: proc.type || 'service',
    stage: stageName,
  };
}

export function parseClierStatus(output: string): ClierStatusOutput {
  const daemon: ClierDaemonInfo = {
    running: false,
    pid: '',
    uptime: '',
    configPath: '',
  };

  try {
    const json: ClierJsonOutput = JSON.parse(output);

    // Parse daemon info
    daemon.running = json.daemon.running;
    daemon.pid = json.daemon.pid?.toString() || '';
    daemon.uptime = json.daemon.uptime || '';
    daemon.configPath = json.daemon.config || '';

    // Parse stages
    const stages: ClierStageInfo[] = [];
    if (json.stages && Array.isArray(json.stages)) {
      for (const stage of json.stages) {
        stages.push({
          name: stage.name,
          processes: stage.processes.map((p) => parseJsonProcess(p, stage.name)),
        });
      }
    }

    // Parse ungrouped processes
    const processes: ClierProcessInfo[] = [];
    if (json.processes && Array.isArray(json.processes)) {
      for (const proc of json.processes) {
        processes.push(parseJsonProcess(proc));
      }
    }

    return { daemon, stages, processes };
  } catch {
    // JSON parsing failed, return empty result
    return { daemon, stages: [], processes: [] };
  }
}

function parseProcess(item: Record<string, unknown>, stageName?: string): ClierPipelineItem {
  const input = item.input as Record<string, unknown> | undefined;
  return {
    name: item.name as string,
    type: (item.type as 'service' | 'task') || 'service',
    command: (item.command as string) || '',
    manual: (item.manual as boolean) ?? false,
    triggerOn: (item.trigger_on as string[]) || [],
    stage: stageName,
    inputEnabled: (input?.enabled as boolean) ?? false,
  };
}

export function loadPipelineConfig(configPath: string): ClierPipelineConfig {
  const result: ClierPipelineConfig = {
    stages: [],
    processes: [],
    stageNames: new Set(),
  };

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    const items_array = config.pipeline || config.services;
    if (Array.isArray(items_array)) {
      for (const item of items_array) {
        if (item.type === 'stage') {
          // This is a stage with nested steps
          result.stageNames.add(item.name);
          const stage: ClierPipelineStage = {
            name: item.name,
            processes: [],
          };
          if (Array.isArray(item.steps)) {
            for (const step of item.steps) {
              stage.processes.push(parseProcess(step, item.name));
            }
          }
          result.stages.push(stage);
        } else {
          // This is a top-level process (not in a stage)
          result.processes.push(parseProcess(item));
        }
      }
    }

    return result;
  } catch {
    return result;
  }
}
