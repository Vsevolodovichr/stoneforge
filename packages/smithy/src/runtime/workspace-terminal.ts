import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import * as pty from 'node-pty';

const MAX_SCROLLBACK_BYTES = 128 * 1024;
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const MAX_DIMENSION = 500;

export interface WorkspacePty {
  readonly pid?: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): { dispose(): void };
  onExit(callback: (event: { exitCode: number; signal?: number }) => void): {
    dispose(): void;
  };
}

export interface WorkspacePtyOptions {
  name: string;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
}

export type WorkspacePtyFactory = (file: string, args: string[], options: WorkspacePtyOptions) => WorkspacePty;

export type WorkspaceTerminalStatus = 'running' | 'exited';

export interface WorkspaceTerminalInfo {
  id: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  pid?: number;
  status: WorkspaceTerminalStatus;
  exitCode?: number;
  signal?: number;
  buffer: string;
}

export interface WorkspaceTerminalCreateOptions {
  cwd?: string;
  cols?: number;
  rows?: number;
  ownerToken?: string;
  workspaceRoot?: string;
}

interface WorkspaceTerminalSession {
  readonly info: WorkspaceTerminalInfo;
  readonly pty: WorkspacePty;
  readonly ownerToken?: string;
  readonly dataListeners: Set<(data: string) => void>;
  readonly exitListeners: Set<(info: WorkspaceTerminalInfo) => void>;
  readonly ptyDataSubscription: { dispose(): void };
  readonly ptyExitSubscription: { dispose(): void };
}

const defaultPtyFactory: WorkspacePtyFactory = (file, args, options) => pty.spawn(file, args, options);

function clampDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_DIMENSION, Math.max(1, Math.floor(value as number)));
}

function getShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.ComSpec || 'cmd.exe', args: [] };
  }

  return { file: process.env.SHELL || '/bin/bash', args: ['-l'] };
}

function toProcessEnv(): Record<string, string> {
  const allowedKeys = new Set([
    'APPDATA',
    'COLORTERM',
    'ComSpec',
    'COMMONPROGRAMFILES',
    'CommonProgramFiles',
    'HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'LANG',
    'LOCALAPPDATA',
    'NUMBER_OF_PROCESSORS',
    'OS',
    'Path',
    'PATH',
    'PATHEXT',
    'PROCESSOR_ARCHITECTURE',
    'ProgramData',
    'PROGRAMDATA',
    'ProgramFiles',
    'PROGRAMFILES',
    'PSModulePath',
    'SystemDrive',
    'SYSTEMDRIVE',
    'SystemRoot',
    'SYSTEMROOT',
    'TEMP',
    'TERM',
    'TMP',
    'USERDOMAIN',
    'USERNAME',
    'USERPROFILE',
    'WINDIR',
  ]);
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && allowedKeys.has(key)) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

export class WorkspaceTerminalService {
  private readonly projectRoot: string;
  private readonly ptyFactory: WorkspacePtyFactory;
  private readonly sessions = new Map<string, WorkspaceTerminalSession>();

  constructor(projectRoot: string, ptyFactory: WorkspacePtyFactory = defaultPtyFactory) {
    this.projectRoot = realpathSync(projectRoot);
    this.ptyFactory = ptyFactory;
  }

  create(options: WorkspaceTerminalCreateOptions = {}): WorkspaceTerminalInfo {
    const workspaceRoot = this.resolveWorkspaceRoot(options.workspaceRoot);
    const cwd = this.resolveWorkspacePath(workspaceRoot, options.cwd);
    const dimensions = {
      cols: clampDimension(options.cols, DEFAULT_COLS),
      rows: clampDimension(options.rows, DEFAULT_ROWS),
    };
    const shell = getShell();
    const info: WorkspaceTerminalInfo = {
      id: `workspace-terminal-${randomUUID()}`,
      cwd,
      shell: shell.file,
      ...dimensions,
      status: 'running',
      buffer: '',
    };
    const ptyProcess = this.ptyFactory(shell.file, shell.args, {
      name: 'xterm-256color',
      ...dimensions,
      cwd,
      env: toProcessEnv(),
    });
    info.pid = ptyProcess.pid;

    const session: WorkspaceTerminalSession = {
      info,
      pty: ptyProcess,
      ownerToken: options.ownerToken,
      dataListeners: new Set(),
      exitListeners: new Set(),
      ptyDataSubscription: ptyProcess.onData((data) => {
        info.buffer = `${info.buffer}${data}`.slice(-MAX_SCROLLBACK_BYTES);
        for (const listener of session.dataListeners) listener(data);
      }),
      ptyExitSubscription: ptyProcess.onExit((event) => {
        info.status = 'exited';
        info.exitCode = event.exitCode;
        info.signal = event.signal;
        for (const listener of session.exitListeners) listener(this.snapshot(session));
      }),
    };

    this.sessions.set(info.id, session);
    return this.snapshot(session);
  }

  attach(id: string, ownerToken?: string): WorkspaceTerminalInfo | undefined {
    const session = this.sessions.get(id);
    if (session) this.assertOwnership(session, ownerToken);
    return session ? this.snapshot(session) : undefined;
  }

  write(id: string, data: string, ownerToken?: string): void {
    const session = this.getRunningSession(id);
    this.assertOwnership(session, ownerToken);
    session.pty.write(data);
  }

  resize(id: string, cols: number, rows: number, ownerToken?: string): void {
    const session = this.getRunningSession(id);
    this.assertOwnership(session, ownerToken);
    const nextCols = clampDimension(cols, session.info.cols);
    const nextRows = clampDimension(rows, session.info.rows);
    session.pty.resize(nextCols, nextRows);
    session.info.cols = nextCols;
    session.info.rows = nextRows;
  }

  close(id: string, ownerToken?: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    this.assertOwnership(session, ownerToken);

    if (session.info.status === 'running') {
      session.pty.kill();
    }
    session.ptyDataSubscription.dispose();
    session.ptyExitSubscription.dispose();
    this.sessions.delete(id);
  }

  onData(id: string, listener: (data: string) => void): () => void {
    const session = this.getSession(id);
    session.dataListeners.add(listener);
    return () => session.dataListeners.delete(listener);
  }

  onExit(id: string, listener: (info: WorkspaceTerminalInfo) => void): () => void {
    const session = this.getSession(id);
    session.exitListeners.add(listener);
    return () => session.exitListeners.delete(listener);
  }

  private resolveWorkspaceRoot(requestedRoot?: string): string {
    const workspaceRoot = realpathSync(resolve(requestedRoot || this.projectRoot));
    if (!statSync(workspaceRoot).isDirectory()) {
      throw new Error('Workspace root is not a directory');
    }
    return workspaceRoot;
  }

  private resolveWorkspacePath(workspaceRoot: string, requestedPath?: string): string {
    const candidate = realpathSync(resolve(workspaceRoot, requestedPath || '.'));
    const relativePath = relative(workspaceRoot, candidate);
    const outsideRoot = relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);

    if (outsideRoot) {
      throw new Error('Terminal working directory is outside the workspace');
    }
    if (!statSync(candidate).isDirectory()) {
      throw new Error('Terminal working directory is not a directory');
    }
    return candidate;
  }

  private getSession(id: string): WorkspaceTerminalSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Workspace terminal not found: ${id}`);
    return session;
  }

  private getRunningSession(id: string): WorkspaceTerminalSession {
    const session = this.getSession(id);
    if (session.info.status !== 'running') {
      throw new Error(`Workspace terminal is not running: ${id}`);
    }
    return session;
  }

  private assertOwnership(session: WorkspaceTerminalSession, ownerToken?: string): void {
    if (session.ownerToken && session.ownerToken !== ownerToken) {
      throw new Error('Workspace terminal ownership check failed');
    }
  }

  private snapshot(session: WorkspaceTerminalSession): WorkspaceTerminalInfo {
    return { ...session.info };
  }
}

export function createWorkspaceTerminalService(projectRoot: string, ptyFactory?: WorkspacePtyFactory): WorkspaceTerminalService {
  return new WorkspaceTerminalService(projectRoot, ptyFactory);
}
