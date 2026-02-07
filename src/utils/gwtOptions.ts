import * as vscode from 'vscode';
import { execCommand } from './exec';
import { getWorkspaceFolder } from './workspace';
import { GwtLaunchOptions } from '../types';

export async function showGwtLaunchOptions(): Promise<GwtLaunchOptions | undefined> {
  // Model picker
  const modelItems: vscode.QuickPickItem[] = [
    { label: 'Default', description: 'Use default Claude model' },
    { label: 'opus', description: 'Claude Opus (most capable)' },
    { label: 'sonnet', description: 'Claude Sonnet (balanced)' },
    { label: 'haiku', description: 'Claude Haiku (fastest)' },
  ];

  const modelPick = await vscode.window.showQuickPick(modelItems, {
    title: 'GWT Options (1/4): Claude Model',
    placeHolder: 'Select Claude model (Escape to use defaults for all)',
  });

  if (modelPick === undefined) {
    // User escaped - use all defaults
    return {};
  }

  const model = modelPick.label === 'Default' ? undefined : modelPick.label;

  // Budget input
  const budget = await vscode.window.showInputBox({
    title: 'GWT Options (2/4): Budget Limit',
    prompt: 'Max budget in USD (leave empty for no limit)',
    placeHolder: 'e.g. 5',
    validateInput: (val) => {
      if (val && isNaN(parseFloat(val))) {
        return 'Must be a number';
      }
      return undefined;
    },
  });

  if (budget === undefined) {
    return { model };
  }

  // Work-only toggle
  const workOnlyItems: vscode.QuickPickItem[] = [
    { label: 'Full lifecycle', description: 'Work + merge + push + cleanup' },
    { label: 'Work only', description: 'Skip merge/push/cleanup (review first)' },
  ];

  const workOnlyPick = await vscode.window.showQuickPick(workOnlyItems, {
    title: 'GWT Options (3/4): Lifecycle',
    placeHolder: 'Select lifecycle mode',
  });

  if (workOnlyPick === undefined) {
    return { model, maxBudgetUsd: budget || undefined };
  }

  const workOnly = workOnlyPick.label === 'Work only';

  // From ref picker
  const fromRef = await showFromRefPicker();

  return {
    model,
    maxBudgetUsd: budget || undefined,
    workOnly,
    fromRef,
  };
}

export async function showFromRefPicker(): Promise<string | undefined> {
  const folder = getWorkspaceFolder();
  if (!folder) {
    return undefined;
  }

  const items: vscode.QuickPickItem[] = [
    { label: 'Current branch', description: 'Use current HEAD as base' },
  ];

  // Fetch branches
  try {
    const branchResult = await execCommand('git', ['branch', '--format=%(refname:short)'], folder);
    if (branchResult.exitCode === 0) {
      const branches = branchResult.stdout.trim().split('\n').filter(Boolean);
      for (const b of branches) {
        items.push({ label: b, description: 'branch' });
      }
    }
  } catch {
    // ignore
  }

  // Fetch recent tags
  try {
    const tagResult = await execCommand('git', ['tag', '--sort=-creatordate', '-l'], folder);
    if (tagResult.exitCode === 0) {
      const tags = tagResult.stdout.trim().split('\n').filter(Boolean).slice(0, 10);
      for (const t of tags) {
        items.push({ label: t, description: 'tag' });
      }
    }
  } catch {
    // ignore
  }

  const pick = await vscode.window.showQuickPick(items, {
    title: 'GWT Options (4/4): Base Ref',
    placeHolder: 'Select base ref for the worktree',
  });

  if (!pick || pick.label === 'Current branch') {
    return undefined;
  }

  return pick.label;
}

export function buildGwtFlags(opts: GwtLaunchOptions): string {
  const parts: string[] = [];

  if (opts.model) {
    parts.push(`--model ${opts.model}`);
  }
  if (opts.maxBudgetUsd) {
    parts.push(`--max-budget-usd ${opts.maxBudgetUsd}`);
  }
  if (opts.workOnly) {
    parts.push('--work-only');
  }
  if (opts.fromRef) {
    parts.push(`--from ${opts.fromRef}`);
  }

  return parts.join(' ');
}
