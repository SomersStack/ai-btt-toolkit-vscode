import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function getEnvWithPath(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // VS Code's extension host often has a limited PATH that doesn't include
  // directories from the user's shell profile. Add common locations.
  const extraPaths = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
  ];
  const currentPath = env.PATH || '';
  const missing = extraPaths.filter((p) => !currentPath.includes(p));
  if (missing.length > 0) {
    env.PATH = [...missing, currentPath].join(path.delimiter);
  }
  return env;
}

export function execCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = 15000
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      env: getEnvWithPath(),
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
