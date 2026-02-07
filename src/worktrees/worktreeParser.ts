import * as path from 'path';
import { WorktreeInfo } from '../types';

export function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    const lines = block.trim().split('\n');
    let wtPath = '';
    let head = '';
    let branch = '';
    let isBare = false;
    let isDetached = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.substring('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        head = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        branch = line.substring('branch '.length);
      } else if (line === 'bare') {
        isBare = true;
      } else if (line === 'detached') {
        isDetached = true;
      }
    }

    if (!wtPath) {
      continue;
    }

    const shortBranch = branch.replace('refs/heads/', '');
    const isMain = !branch.includes('/') ? false : isMainWorktree(wtPath, blocks.indexOf(block));
    const isGwt = isGwtWorktree(wtPath);

    worktrees.push({
      path: wtPath,
      branch,
      shortBranch: shortBranch || (isDetached ? `(detached)` : '(bare)'),
      head,
      isBare,
      isMain: blocks.indexOf(block) === 0,
      isDetached,
      isGwt,
    });
  }

  return worktrees;
}

function isMainWorktree(_wtPath: string, index: number): boolean {
  return index === 0;
}

function isGwtWorktree(wtPath: string): boolean {
  const dirName = path.basename(wtPath);
  // gwt creates worktrees in .git/worktrees/ - linked worktrees have paths outside main repo
  // A heuristic: gwt worktrees typically have branch-name based directory names
  // The first worktree (index 0) is always the main one
  return dirName.includes('-') || dirName.match(/^[a-z]/) !== null;
}

export function sortWorktrees(worktrees: WorktreeInfo[]): WorktreeInfo[] {
  return worktrees.sort((a, b) => {
    // Main worktree first
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    // Then gwt worktrees
    if (a.isGwt && !b.isGwt) return -1;
    if (!a.isGwt && b.isGwt) return 1;
    // Then alphabetically by branch
    return a.shortBranch.localeCompare(b.shortBranch);
  });
}
