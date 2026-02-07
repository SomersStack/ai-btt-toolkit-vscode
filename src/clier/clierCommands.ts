import * as vscode from 'vscode';
import { execCommand } from '../utils/exec';
import { getWorkspaceFolder } from '../utils/workspace';
import { ProcessItem } from './clierItems';
import { ClierProvider } from './clierProvider';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

type LogOption =
  | { type: 'lines'; count: number | 'all' }
  | { type: 'since'; duration: string };

function buildLogArgs(target: string | '--daemon', option: LogOption): string[] {
  const args = ['logs'];
  if (target === '--daemon') {
    args.push('--daemon');
  } else {
    args.push(target);
  }

  if (option.type === 'lines') {
    if (option.count !== 'all') {
      args.push('-n', String(option.count));
    }
  } else {
    args.push('--since', option.duration);
  }

  return args;
}

async function showLogs(
  folder: string,
  channelName: string,
  target: string | '--daemon',
  option: LogOption
): Promise<void> {
  const args = buildLogArgs(target, option);
  const result = await execCommand('clier', args, folder);
  const channel = vscode.window.createOutputChannel(channelName);
  channel.clear();
  channel.append(stripAnsi(result.stdout));
  channel.show();
}

export function registerClierCommands(
  context: vscode.ExtensionContext,
  provider: ClierProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.clier.refresh', () => {
      provider.refresh();
    }),

    // Daemon commands
    vscode.commands.registerCommand('workflow.clier.daemon.start', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      const terminal = vscode.window.createTerminal({
        name: 'Clier Daemon',
        cwd: folder,
      });
      terminal.show();
      terminal.sendText('clier start');

      // Delayed refresh to let daemon start
      setTimeout(() => provider.refresh(), 3000);
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.stop', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['stop'], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage('Clier daemon stopped.');
        } else {
          vscode.window.showErrorMessage(`Failed to stop daemon: ${result.stderr}`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to stop daemon: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.restart', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['restart'], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage('Clier daemon restarted.');
        } else {
          vscode.window.showErrorMessage(`Failed to restart daemon: ${result.stderr}`);
        }
        setTimeout(() => provider.refresh(), 3000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to restart daemon: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'lines', count: 200 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.200', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'lines', count: 200 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.500', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'lines', count: 500 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.all', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'lines', count: 'all' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.5m', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'since', duration: '5m' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.30m', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'since', duration: '30m' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.1h', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, 'Clier: Daemon', '--daemon', { type: 'since', duration: '1h' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get daemon logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.daemon.logs.clear', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['logs', 'clear', '--daemon'], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage('Daemon logs cleared.');
        } else {
          vscode.window.showErrorMessage(`Failed to clear daemon logs: ${result.stderr}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to clear daemon logs: ${message}`);
      }
    }),

    // Process commands
    vscode.commands.registerCommand('workflow.clier.process.start', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['run', item.process.name], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Process "${item.process.name}" started.`);
        } else {
          vscode.window.showErrorMessage(`Failed to start process: ${result.stderr}`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to start process: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.stop', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['stop', item.process.name], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Process "${item.process.name}" stopped.`);
        } else {
          vscode.window.showErrorMessage(`Failed to stop process: ${result.stderr}`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to stop process: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.restart', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['restart', item.process.name], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Process "${item.process.name}" restarted.`);
        } else {
          vscode.window.showErrorMessage(`Failed to restart process: ${result.stderr}`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to restart process: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.kill', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Force kill process "${item.process.name}"?`,
        { modal: true },
        'Kill'
      );
      if (confirm !== 'Kill') return;

      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['kill', item.process.name], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Process "${item.process.name}" killed.`);
        } else {
          vscode.window.showErrorMessage(`Failed to kill process: ${result.stderr}`);
        }
        provider.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to kill process: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'lines', count: 200 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.200', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'lines', count: 200 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.500', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'lines', count: 500 });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.all', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'lines', count: 'all' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.5m', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'since', duration: '5m' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.30m', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'since', duration: '30m' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.1h', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        await showLogs(folder, `Clier: ${item.process.name}`, item.process.name, { type: 'since', duration: '1h' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to get process logs: ${message}`);
      }
    }),

    vscode.commands.registerCommand('workflow.clier.process.logs.clear', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      try {
        const result = await execCommand('clier', ['logs', 'clear', item.process.name], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Logs cleared for "${item.process.name}".`);
        } else {
          vscode.window.showErrorMessage(`Failed to clear process logs: ${result.stderr}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to clear process logs: ${message}`);
      }
    }),

    // Hide/unhide/toggle commands
    vscode.commands.registerCommand('workflow.clier.process.hide', (item: ProcessItem) => {
      provider.hideProcess(item.process.name);
    }),

    vscode.commands.registerCommand('workflow.clier.process.unhide', (item: ProcessItem) => {
      provider.unhideProcess(item.process.name);
    }),

    vscode.commands.registerCommand('workflow.clier.toggleHidden', () => {
      provider.toggleShowHidden();
    }),

    vscode.commands.registerCommand('workflow.clier.toggleHiddenOff', () => {
      provider.toggleShowHidden();
    }),

    vscode.commands.registerCommand('workflow.clier.process.send', async (item: ProcessItem) => {
      if (!item?.process) {
        vscode.window.showErrorMessage('Please select a process from the Pipeline view.');
        return;
      }
      const folder = getWorkspaceFolder();
      if (!folder) return;

      const input = await vscode.window.showInputBox({
        prompt: `Send input to ${item.process.name}`,
        placeHolder: 'Enter text to send...',
      });

      if (input === undefined) return; // User cancelled

      try {
        const result = await execCommand('clier', ['send', item.process.name, input], folder);
        if (result.exitCode === 0) {
          vscode.window.showInformationMessage(`Input sent to "${item.process.name}".`);
        } else {
          vscode.window.showErrorMessage(`Failed to send input: ${result.stderr}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to send input: ${message}`);
      }
    })
  );
}
