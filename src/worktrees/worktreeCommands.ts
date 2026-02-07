import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execCommand } from '../utils/exec';
import { getWorkspaceFolder } from '../utils/workspace';
import { showGwtLaunchOptions, buildGwtFlags } from '../utils/gwtOptions';
import { WorktreeItem } from './worktreeItems';
import { WorktreeProvider } from './worktreeProvider';

export function registerWorktreeCommands(
  context: vscode.ExtensionContext,
  provider: WorktreeProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.worktrees.refresh', () => {
      provider.refresh();
    }),

    vscode.commands.registerCommand('workflow.worktrees.create', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter a prompt for gwt to create a new worktree',
        placeHolder: 'e.g. fix login bug',
      });
      if (!prompt) {
        return;
      }

      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: 'gwt create',
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt "${prompt}"`);

      // Refresh after a delay to pick up the new worktree
      setTimeout(() => provider.refresh(), 5000);
    }),

    vscode.commands.registerCommand('workflow.worktrees.merge', async (item: WorktreeItem) => {
      const branch = item.worktree.shortBranch;
      const confirm = await vscode.window.showWarningMessage(
        `Merge branch "${branch}" into the current branch?`,
        { modal: true },
        'Merge'
      );
      if (confirm !== 'Merge') {
        return;
      }

      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: `gwt merge ${branch}`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt merge ${branch}`);
    }),

    vscode.commands.registerCommand('workflow.worktrees.rescue', async (item: WorktreeItem) => {
      const branch = item.worktree.shortBranch;
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      // Ask about work-only mode
      const modeItems: vscode.QuickPickItem[] = [
        { label: 'Full lifecycle', description: 'Rescue + merge + push + cleanup' },
        { label: 'Work only', description: 'Rescue without merge/push/cleanup' },
      ];

      const modePick = await vscode.window.showQuickPick(modeItems, {
        placeHolder: 'Select rescue mode',
      });
      if (!modePick) {
        return;
      }

      const workOnlyFlag = modePick.label === 'Work only' ? ' --work-only' : '';

      const terminal = vscode.window.createTerminal({
        name: `gwt rescue ${branch}`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt rescue ${branch}${workOnlyFlag}`);
    }),

    vscode.commands.registerCommand('workflow.worktrees.delete', async (item: WorktreeItem) => {
      const branch = item.worktree.shortBranch;
      const choice = await vscode.window.showWarningMessage(
        `Delete worktree "${branch}"?`,
        { modal: true },
        'Delete',
        'Force Delete'
      );
      if (!choice) {
        return;
      }

      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      try {
        const args = choice === 'Force Delete'
          ? ['delete', '--force', branch]
          : ['delete', branch];
        const result = await execCommand('gwt', args, folder, 30000);
        if (result.exitCode !== 0) {
          vscode.window.showErrorMessage(`Failed to delete worktree: ${result.stderr}`);
        } else {
          vscode.window.showInformationMessage(`Worktree "${branch}" deleted.`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to delete worktree: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.worktrees.openWindow', async (item: WorktreeItem) => {
      const uri = vscode.Uri.file(item.worktree.path);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }),

    vscode.commands.registerCommand('workflow.worktrees.claudeSession', async (item: WorktreeItem) => {
      const terminal = vscode.window.createTerminal({
        name: `Claude: ${item.worktree.shortBranch}`,
        cwd: item.worktree.path,
      });
      terminal.show();
      terminal.sendText('claude --resume || claude');
    }),

    // New GWT agent session (with prompt + options)
    vscode.commands.registerCommand('workflow.worktrees.gwtSession', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Describe the task for the new GWT agent session',
        placeHolder: 'e.g. implement user authentication',
      });
      if (!prompt) {
        return;
      }

      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const opts = await showGwtLaunchOptions();
      const flags = opts ? buildGwtFlags(opts) : '';
      const flagStr = flags ? ` ${flags}` : '';

      const terminal = vscode.window.createTerminal({
        name: `GWT: ${prompt.substring(0, 30)}`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt "${prompt}"${flagStr}`);

      setTimeout(() => provider.refresh(), 5000);
    }),

    // New GWT interactive session (no prompt)
    vscode.commands.registerCommand('workflow.worktrees.gwtSessionInteractive', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: 'GWT: interactive',
        cwd: folder,
      });
      terminal.show();
      terminal.sendText('gwt');

      setTimeout(() => provider.refresh(), 5000);
    }),

    // Split task into parallel agent sessions
    vscode.commands.registerCommand('workflow.worktrees.gwtSplit', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task to split into parallel agent sessions',
        placeHolder: 'e.g. build auth module, add tests, update docs',
      });
      if (!task) {
        return;
      }

      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const opts = await showGwtLaunchOptions();
      const flags = opts ? buildGwtFlags(opts) : '';
      const flagStr = flags ? ` ${flags}` : '';

      const terminal = vscode.window.createTerminal({
        name: `GWT Split: ${task.substring(0, 25)}`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt split "${task}"${flagStr}`);

      setTimeout(() => provider.refresh(), 10000);
    }),

    // Split from editor (file input)
    vscode.commands.registerCommand('workflow.worktrees.gwtSplitFromEditor', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      // Create a temp file for the task description
      const tmpDir = path.join(os.tmpdir(), 'gwt-split');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpFile = path.join(tmpDir, `task-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, '# Task Description\n\nDescribe the task to split into parallel agent sessions.\nEach independent sub-task should be clearly described.\n\n');

      // Open the file in the editor
      const doc = await vscode.workspace.openTextDocument(tmpFile);
      await vscode.window.showTextDocument(doc);

      // Show info message with run button
      const action = await vscode.window.showInformationMessage(
        'Edit the task file, save it, then click "Run Split" to execute.',
        'Run Split',
        'Cancel'
      );

      if (action !== 'Run Split') {
        // Clean up
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
        return;
      }

      const opts = await showGwtLaunchOptions();
      const flags = opts ? buildGwtFlags(opts) : '';
      const flagStr = flags ? ` ${flags}` : '';

      const terminal = vscode.window.createTerminal({
        name: 'GWT Split (file)',
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt split --file "${tmpFile}"${flagStr}`);

      setTimeout(() => provider.refresh(), 10000);
    }),

    // Batch merge selected worktrees
    vscode.commands.registerCommand('workflow.worktrees.mergeSelected', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      // Get list of non-main worktrees for selection
      const result = await execCommand('git', ['worktree', 'list', '--porcelain'], folder);
      if (result.exitCode !== 0) {
        vscode.window.showErrorMessage('Failed to list worktrees');
        return;
      }

      const branches = extractBranches(result.stdout);
      if (branches.length === 0) {
        vscode.window.showInformationMessage('No non-main worktrees to merge.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        branches.map((b) => ({ label: b })),
        { canPickMany: true, placeHolder: 'Select worktrees to merge' }
      );

      if (!selected || selected.length === 0) {
        return;
      }

      const branchList = selected.map((s) => s.label).join(' ');

      const confirm = await vscode.window.showWarningMessage(
        `Merge ${selected.length} branch(es) into the current branch?`,
        { modal: true },
        'Merge All'
      );
      if (confirm !== 'Merge All') {
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: `gwt merge (${selected.length})`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt merge ${branchList}`);
    }),

    // Batch delete selected worktrees
    vscode.commands.registerCommand('workflow.worktrees.deleteSelected', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const result = await execCommand('git', ['worktree', 'list', '--porcelain'], folder);
      if (result.exitCode !== 0) {
        vscode.window.showErrorMessage('Failed to list worktrees');
        return;
      }

      const branches = extractBranches(result.stdout);
      if (branches.length === 0) {
        vscode.window.showInformationMessage('No non-main worktrees to delete.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        branches.map((b) => ({ label: b })),
        { canPickMany: true, placeHolder: 'Select worktrees to delete' }
      );

      if (!selected || selected.length === 0) {
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        `Delete ${selected.length} worktree(s)?`,
        { modal: true },
        'Delete',
        'Force Delete'
      );
      if (!choice) {
        return;
      }

      const branchList = selected.map((s) => s.label).join(' ');
      const forceFlag = choice === 'Force Delete' ? ' --force' : '';

      const terminal = vscode.window.createTerminal({
        name: `gwt delete (${selected.length})`,
        cwd: folder,
      });
      terminal.show();
      terminal.sendText(`gwt delete ${branchList}${forceFlag}`);

      setTimeout(() => provider.refresh(), 5000);
    }),

    // Diff preview for a worktree
    vscode.commands.registerCommand('workflow.worktrees.diff', async (item: WorktreeItem) => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const branch = item.worktree.shortBranch;

      try {
        // Get list of changed files
        const result = await execCommand(
          'git',
          ['diff', '--name-only', `HEAD...${branch}`],
          folder
        );

        if (result.exitCode !== 0 || !result.stdout.trim()) {
          vscode.window.showInformationMessage(`No differences found for "${branch}".`);
          return;
        }

        const files = result.stdout.trim().split('\n');

        // Show quick pick of files, open diff on selection
        const selected = await vscode.window.showQuickPick(
          files.map((f) => ({ label: f })),
          { placeHolder: `${files.length} file(s) changed in ${branch}` }
        );

        if (selected) {
          const mainUri = vscode.Uri.file(path.join(folder, selected.label));
          const branchUri = vscode.Uri.parse(
            `git-worktree://${branch}/${selected.label}?branch=${branch}`
          );

          // Use git show to get the file content from the branch
          const branchContent = await execCommand(
            'git',
            ['show', `${branch}:${selected.label}`],
            folder
          );
          const mainContent = await execCommand(
            'git',
            ['show', `HEAD:${selected.label}`],
            folder
          );

          if (branchContent.exitCode === 0) {
            // Open the diff using temp files
            const tmpDir = path.join(os.tmpdir(), 'gwt-diff');
            if (!fs.existsSync(tmpDir)) {
              fs.mkdirSync(tmpDir, { recursive: true });
            }

            const mainFile = path.join(tmpDir, `main-${path.basename(selected.label)}`);
            const branchFile = path.join(tmpDir, `${branch.replace(/\//g, '-')}-${path.basename(selected.label)}`);

            fs.writeFileSync(mainFile, mainContent.stdout);
            fs.writeFileSync(branchFile, branchContent.stdout);

            await vscode.commands.executeCommand(
              'vscode.diff',
              vscode.Uri.file(mainFile),
              vscode.Uri.file(branchFile),
              `${selected.label} (HEAD vs ${branch})`
            );
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to show diff: ${message}`);
      }
    }),

    // Hide/unhide/toggle commands
    vscode.commands.registerCommand('workflow.worktrees.hide', (item: WorktreeItem) => {
      provider.hideWorktree(item.worktree.shortBranch);
    }),

    vscode.commands.registerCommand('workflow.worktrees.unhide', (item: WorktreeItem) => {
      provider.unhideWorktree(item.worktree.shortBranch);
    }),

    vscode.commands.registerCommand('workflow.worktrees.toggleHidden', () => {
      provider.toggleShowHidden();
    }),

    vscode.commands.registerCommand('workflow.worktrees.toggleHiddenOff', () => {
      provider.toggleShowHidden();
    }),

    // GWT docs viewer
    vscode.commands.registerCommand('workflow.worktrees.docs', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) {
        return;
      }

      const topics: vscode.QuickPickItem[] = [
        { label: 'Overview', description: 'General gwt documentation' },
        { label: 'split', description: 'Parallel task decomposition' },
        { label: 'rescue', description: 'Resume work in orphaned worktree' },
        { label: 'merge', description: 'Merge a worktree branch' },
        { label: 'delete', description: 'Remove worktree and branch' },
        { label: 'status', description: 'Show worktree and session status' },
        { label: 'workflows', description: 'Common gwt workflows' },
      ];

      const pick = await vscode.window.showQuickPick(topics, {
        placeHolder: 'Select a docs topic',
      });
      if (!pick) {
        return;
      }

      const args = pick.label === 'Overview' ? ['docs'] : ['docs', pick.label];
      const result = await execCommand('gwt', args, folder);

      if (result.exitCode !== 0) {
        vscode.window.showErrorMessage('Failed to fetch gwt docs');
        return;
      }

      // Show in a webview panel
      const panel = vscode.window.createWebviewPanel(
        'gwtDocs',
        `GWT Docs: ${pick.label}`,
        vscode.ViewColumn.One,
        {}
      );

      const content = escapeHtml(result.stdout);
      panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      padding: 20px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      white-space: pre-wrap;
      line-height: 1.5;
    }
  </style>
</head>
<body>${content}</body>
</html>`;
    })
  );
}

function extractBranches(porcelainOutput: string): string[] {
  const branches: string[] = [];
  const blocks = porcelainOutput.trim().split('\n\n');

  for (let i = 0; i < blocks.length; i++) {
    if (i === 0) continue; // Skip main worktree
    const block = blocks[i];
    if (!block.trim()) continue;

    for (const line of block.split('\n')) {
      if (line.startsWith('branch ')) {
        branches.push(line.substring('branch '.length).replace('refs/heads/', ''));
        break;
      }
    }
  }

  return branches;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
