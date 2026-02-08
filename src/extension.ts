import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceFolder, hasGitRepo, hasClierConfig, isCommandInstalled } from './utils/workspace';
import { WorktreeProvider } from './worktrees/worktreeProvider';
import { registerWorktreeCommands } from './worktrees/worktreeCommands';
import { ClierProvider } from './clier/clierProvider';
import { registerClierCommands } from './clier/clierCommands';
import { ToolsProvider } from './tools/toolsProvider';
import { registerToolsCommands } from './tools/toolsCommands';
import { GetStartedProvider } from './getStarted/getStartedProvider';
import { registerGetStartedCommands } from './getStarted/getStartedCommands';

const GWT_TERMINAL_PREFIXES = ['gwt', 'GWT', 'Claude:'];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const folder = getWorkspaceFolder();

  // Check tool installations in parallel
  const [gwtInstalled, clierInstalled] = await Promise.all([
    isCommandInstalled('gwt'),
    isCommandInstalled('clier'),
  ]);

  // Set installation context keys
  vscode.commands.executeCommand('setContext', 'workflowGwtInstalled', gwtInstalled);
  vscode.commands.executeCommand('setContext', 'workflowClierInstalled', clierInstalled);

  // Read and set force-show overrides from workspace state
  const forceShowWorktrees = context.workspaceState.get<boolean>('workflow.forceShowWorktrees', false);
  const forceShowClier = context.workspaceState.get<boolean>('workflow.forceShowClier', false);
  vscode.commands.executeCommand('setContext', 'workflowForceShowWorktrees', forceShowWorktrees);
  vscode.commands.executeCommand('setContext', 'workflowForceShowClier', forceShowClier);

  // Initialize context keys for hidden toggle state
  vscode.commands.executeCommand('setContext', 'workflowShowHiddenWorktrees', context.workspaceState.get<boolean>('workflow.showHiddenWorktrees', false));
  vscode.commands.executeCommand('setContext', 'workflowShowHiddenProcesses', context.workspaceState.get<boolean>('workflow.showHiddenProcesses', false));

  // Initialize Get Started context keys
  vscode.commands.executeCommand('setContext', 'workflowWorktreesHasContent', false);
  vscode.commands.executeCommand('setContext', 'workflowClierHasContent', false);
  const forceShowGetStarted = context.workspaceState.get<boolean>('workflow.forceShowGetStarted', false);
  vscode.commands.executeCommand('setContext', 'workflowForceShowGetStarted', forceShowGetStarted);

  // Always register both providers so the views have data providers.
  // They return empty arrays when their tool isn't available.
  const worktreeProvider = new WorktreeProvider(context.workspaceState);
  worktreeProvider.gwtInstalled = gwtInstalled;
  const worktreeView = vscode.window.createTreeView('workflowWorktrees', {
    treeDataProvider: worktreeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(worktreeView);
  registerWorktreeCommands(context, worktreeProvider);

  const clierProvider = new ClierProvider(context.workspaceState);
  clierProvider.clierInstalled = clierInstalled;
  const clierView = vscode.window.createTreeView('workflowClier', {
    treeDataProvider: clierProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(clierView);
  registerClierCommands(context, clierProvider);

  const toolsProvider = new ToolsProvider();
  const toolsView = vscode.window.createTreeView('workflowTools', {
    treeDataProvider: toolsProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(toolsView);
  registerToolsCommands(context);

  const getStartedProvider = new GetStartedProvider();
  getStartedProvider.gwtInstalled = gwtInstalled;
  getStartedProvider.clierInstalled = clierInstalled;
  const getStartedView = vscode.window.createTreeView('workflowGetStarted', {
    treeDataProvider: getStartedProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(getStartedView);
  registerGetStartedCommands(context, getStartedProvider);

  // "Show Worktrees" command — force-show the view even if gwt is not installed
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.worktrees.show', async () => {
      await context.workspaceState.update('workflow.forceShowWorktrees', true);
      vscode.commands.executeCommand('setContext', 'workflowForceShowWorktrees', true);
    })
  );

  // "Show Pipeline" command — force-show the view even if clier is not installed
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.clier.show', async () => {
      await context.workspaceState.update('workflow.forceShowClier', true);
      vscode.commands.executeCommand('setContext', 'workflowForceShowClier', true);
    })
  );

  // Open a terminal to install a tool
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.openInstallTerminal', (toolName: string, installCommand: string) => {
      const terminal = vscode.window.createTerminal(`Install ${toolName}`);
      terminal.show();
      terminal.sendText(installCommand);
    })
  );

  // Auto-refresh worktree view and show notifications when GWT terminals close
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(async (terminal) => {
      const name = terminal.name;
      const isGwtTerminal = GWT_TERMINAL_PREFIXES.some((prefix) => name.startsWith(prefix));

      if (isGwtTerminal) {
        // Refresh the worktree list immediately
        worktreeProvider.refresh();

        // Show a notification
        if (name.startsWith('gwt merge') || name.startsWith('GWT Split')) {
          vscode.window.showInformationMessage(`GWT session finished: ${name}`);
        } else if (name.startsWith('gwt create') || name.startsWith('GWT:')) {
          vscode.window.showInformationMessage(`GWT session finished: ${name}`);
        } else if (name.startsWith('gwt rescue')) {
          vscode.window.showInformationMessage(`GWT rescue finished: ${name}`);
        } else if (name.startsWith('gwt delete')) {
          vscode.window.showInformationMessage(`GWT delete finished: ${name}`);
        } else if (name.startsWith('Claude:')) {
          vscode.window.showInformationMessage(`Claude session closed: ${name}`);
        }
      }

      // Re-check tool installation after Install terminals close
      if (name.startsWith('Install ')) {
        const [newGwt, newClier] = await Promise.all([
          isCommandInstalled('gwt'),
          isCommandInstalled('clier'),
        ]);
        vscode.commands.executeCommand('setContext', 'workflowGwtInstalled', newGwt);
        vscode.commands.executeCommand('setContext', 'workflowClierInstalled', newClier);
        worktreeProvider.gwtInstalled = newGwt;
        clierProvider.clierInstalled = newClier;
        getStartedProvider.gwtInstalled = newGwt;
        getStartedProvider.clierInstalled = newClier;
      }
    })
  );

  if (!folder) {
    return;
  }

  const gitAvailable = hasGitRepo(folder);
  const clierAvailable = hasClierConfig(folder);

  // Set context keys (still useful for menu when clauses)
  vscode.commands.executeCommand('setContext', 'workflowGitAvailable', gitAvailable);
  vscode.commands.executeCommand('setContext', 'workflowClierAvailable', clierAvailable);

  // Git worktree file watcher
  if (gitAvailable) {
    const gitWorktreesPath = path.join(folder, '.git', 'worktrees');
    const worktreeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitWorktreesPath, '**')
    );
    worktreeWatcher.onDidCreate(() => worktreeProvider.refresh());
    worktreeWatcher.onDidDelete(() => worktreeProvider.refresh());
    worktreeWatcher.onDidChange(() => worktreeProvider.refresh());
    context.subscriptions.push(worktreeWatcher);
  }

  // Clier polling + config watcher
  if (clierAvailable) {
    const pollingDisposable = clierProvider.startPolling(clierView);
    context.subscriptions.push(pollingDisposable);

    const configWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, 'clier-pipeline.json')
    );
    configWatcher.onDidChange(() => clierProvider.refresh());
    configWatcher.onDidCreate(() => {
      vscode.commands.executeCommand('setContext', 'workflowClierAvailable', true);
      clierProvider.refresh();
    });
    configWatcher.onDidDelete(() => {
      vscode.commands.executeCommand('setContext', 'workflowClierAvailable', false);
    });
    context.subscriptions.push(configWatcher);
  }
}

export function deactivate(): void {
  // All disposables are cleaned up via context.subscriptions
}
