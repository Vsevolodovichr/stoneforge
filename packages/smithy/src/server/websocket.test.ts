import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceTerminalService, type WorkspacePty } from '../runtime/workspace-terminal.js';
import type { Services } from './services.js';
import { handleWSMessage, handleWSClose, handleWSOpen } from './websocket.js';
import type { ServerWebSocket, WSClientData } from './types.js';

function createFakePty() {
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<(event: { exitCode: number; signal?: number }) => void>();
  const calls = { writes: [] as string[], resizes: [] as Array<{ cols: number; rows: number }>, killed: 0 };
  const pty: WorkspacePty = {
    pid: 1234,
    write: (data) => calls.writes.push(data),
    resize: (cols, rows) => calls.resizes.push({ cols, rows }),
    kill: () => { calls.killed++; },
    onData: (callback) => {
      dataListeners.add(callback);
      return { dispose: () => dataListeners.delete(callback) };
    },
    onExit: (callback) => {
      exitListeners.add(callback);
      return { dispose: () => exitListeners.delete(callback) };
    },
  };
  return { pty, calls, emitData: (data: string) => dataListeners.forEach((listener) => listener(data)) };
}

function createWebSocket(): { ws: ServerWebSocket<WSClientData>; messages: Array<Record<string, unknown>> } {
  const messages: Array<Record<string, unknown>> = [];
  const ws = {
    data: { id: '' },
    send: (message: string) => messages.push(JSON.parse(message) as Record<string, unknown>),
    close: () => undefined,
    readyState: 1,
  } satisfies ServerWebSocket<WSClientData>;
  return { ws, messages };
}

describe('workspace terminal WebSocket protocol', () => {
  it('creates, streams, resizes, and closes an owned workspace terminal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-ws-'));
    await mkdir(join(root, 'apps'));
    const fake = createFakePty();
    const workspaceTerminalService = new WorkspaceTerminalService(root, () => fake.pty);
    const services = {
      workspaceTerminalService,
      projectRegistry: { getActiveProject: () => undefined },
    } as unknown as Services;
    const { ws, messages } = createWebSocket();

    handleWSOpen(ws);
    handleWSMessage(ws, JSON.stringify({ type: 'workspace-create', cwd: join(root, 'apps'), ownerToken: 'owner-a' }), services);
    const started = messages.find((message) => message.type === 'workspace-session-started');
    const sessionId = started?.sessionId as string;

    expect(sessionId).toBeTruthy();
    fake.emitData('prompt> ');
    handleWSMessage(ws, JSON.stringify({ type: 'workspace-input', input: 'dir\r' }), services);
    handleWSMessage(ws, JSON.stringify({ type: 'workspace-resize', cols: 100, rows: 28 }), services);
    expect(messages.some((message) => message.type === 'workspace-data' && message.data === 'prompt> ')).toBe(true);
    expect(fake.calls.writes).toEqual(['dir\r']);
    expect(fake.calls.resizes).toEqual([{ cols: 100, rows: 28 }]);

    handleWSMessage(ws, JSON.stringify({ type: 'workspace-close', sessionId, ownerToken: 'owner-a' }), services);
    expect(fake.calls.killed).toBe(1);
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a different owner and cleans up disconnected sessions after the idle timeout', async () => {
    vi.useFakeTimers();
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-ws-'));
    const fake = createFakePty();
    const workspaceTerminalService = new WorkspaceTerminalService(root, () => fake.pty);
    const services = {
      workspaceTerminalService,
      projectRegistry: { getActiveProject: () => undefined },
    } as unknown as Services;
    const first = createWebSocket();
    const second = createWebSocket();

    handleWSOpen(first.ws);
    handleWSMessage(first.ws, JSON.stringify({ type: 'workspace-create', ownerToken: 'owner-a' }), services);
    const sessionId = first.messages.find((message) => message.type === 'workspace-session-started')?.sessionId as string;
    handleWSOpen(second.ws);
    handleWSMessage(second.ws, JSON.stringify({ type: 'workspace-attach', sessionId, ownerToken: 'owner-b' }), services);

    expect(second.messages.at(-1)?.type).toBe('error');
    handleWSClose(first.ws, services);
    vi.advanceTimersByTime(60_000);
    expect(fake.calls.killed).toBe(1);

    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });
});
