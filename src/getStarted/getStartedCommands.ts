import * as vscode from 'vscode';
import { execCommand } from '../utils/exec';
import { GetStartedProvider } from './getStartedProvider';

const readmeCache = new Map<string, string>();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function showReadmeWebview(packageName: string, title: string): Promise<void> {
  const cached = readmeCache.get(packageName);
  if (cached) {
    openWebviewPanel(title, cached);
    return;
  }

  try {
    const result = await execCommand('npm', ['view', packageName, 'readme'], process.cwd(), 30000);
    if (result.exitCode !== 0) {
      vscode.window.showErrorMessage(`Failed to fetch ${title}: ${result.stderr}`);
      return;
    }
    const readme = result.stdout;
    readmeCache.set(packageName, readme);
    openWebviewPanel(title, readme);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to fetch ${title}: ${message}`);
  }
}

function openWebviewPanel(title: string, content: string): void {
  const panel = vscode.window.createWebviewPanel(
    'getStartedGuide',
    title,
    vscode.ViewColumn.One,
    {}
  );

  const escaped = escapeHtml(content);
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
<body>${escaped}</body>
</html>`;
}

export function registerGetStartedCommands(
  context: vscode.ExtensionContext,
  provider: GetStartedProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('workflow.getStarted.gwtReadme', () => {
      showReadmeWebview('ai-git-worktrees', 'GWT Guide');
    }),

    vscode.commands.registerCommand('workflow.getStarted.clierReadme', () => {
      showReadmeWebview('clier-ai', 'Clier Guide');
    }),

    vscode.commands.registerCommand('workflow.getStarted.show', async () => {
      await context.workspaceState.update('workflow.forceShowGetStarted', true);
      vscode.commands.executeCommand('setContext', 'workflowForceShowGetStarted', true);
    }),

    vscode.commands.registerCommand('workflow.getStarted.hide', async () => {
      await context.workspaceState.update('workflow.forceShowGetStarted', false);
      vscode.commands.executeCommand('setContext', 'workflowForceShowGetStarted', false);
    }),

    vscode.commands.registerCommand('workflow.getStarted.refresh', () => {
      provider.refresh();
    })
  );
}
