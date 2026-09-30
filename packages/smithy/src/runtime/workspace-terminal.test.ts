import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspaceTerminalService, type WorkspacePty } from './workspace-terminal.js';

function createFakePty() {
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<(event: { exitCode: number; signal?: number }) => void>();
  const calls = {
    writes: [] as string[],
    resizes: [] as Array<{ cols: number; rows: number }>,
    killed: 0,
  };

  const pty: WorkspacePty = {
    pid: 1234,
    write(data) {
      calls.writes.push(data);
    },
    resize(cols, rows) {
      calls.resizes.push({ cols, rows });
    },
    kill() {
      calls.killed++;
    },
    onData(callback) {
      dataListeners.add(callback);
      return { dispose: () => dataListeners.delete(callback) };
    },
    onExit(callback) {
      exitListeners.add(callback);
      return { dispose: () => exitListeners.delete(callback) };
    },
  };

  return {
    pty,
    calls,
    emitData(data: string) {
      for (const listener of dataListeners) listener(data);
    },
    emitExit(exitCode: number) {
      for (const listener of exitListeners) listener({ exitCode });
    },
  };
}

describe('WorkspaceTerminalService', () => {
  it('creates a terminal inside the project root and forwards PTY operations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-terminal-'));
    const cwd = join(root, 'apps');
    await mkdir(cwd);
    const fake = createFakePty();
    const service = new WorkspaceTerminalService(root, () => fake.pty);

    const terminal = service.create({ cwd, cols: 100, rows: 28 });
    service.write(terminal.id, 'dir\r');
    service.resize(terminal.id, 120, 32);
    service.close(terminal.id);

    expect(terminal.cwd).toBe(cwd);
    expect(fake.calls.writes).toEqual(['dir\r']);
    expect(fake.calls.resizes).toEqual([{ cols: 120, rows: 32 }]);
    expect(fake.calls.killed).toBe(1);
    await rm(root, { recursive: true, force: true });
  });

  it('rejects a terminal working directory outside the project root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-terminal-'));
    const outside = await mkdtemp(join(tmpdir(), 'stoneforge-terminal-outside-'));
    const service = new WorkspaceTerminalService(root, () => createFakePty().pty);

    expect(() => service.create({ cwd: outside })).toThrow('outside the workspace');

    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('keeps recent output available when a client reconnects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-terminal-'));
    const fake = createFakePty();
    const service = new WorkspaceTerminalService(root, () => fake.pty);
    const terminal = service.create({});

    fake.emitData('first line\r\n');
    fake.emitData('second line\r\n');

    expect(service.attach(terminal.id)?.buffer).toContain('first line');
    expect(service.attach(terminal.id)?.buffer).toContain('second line');

    await rm(root, { recursive: true, force: true });
  });

  it('requires the owner token for workspace session operations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stoneforge-terminal-'));
    const fake = createFakePty();
    const service = new WorkspaceTerminalService(root, () => fake.pty);
    const terminal = service.create({ ownerToken: 'owner-a' });

    expect(() => service.attach(terminal.id, 'owner-b')).toThrow('ownership check failed');
    expect(() => service.write(terminal.id, 'dir\r', 'owner-b')).toThrow('ownership check failed');
    expect(() => service.close(terminal.id, 'owner-b')).toThrow('ownership check failed');
    expect(service.attach(terminal.id, 'owner-a')?.id).toBe(terminal.id);

    service.close(terminal.id, 'owner-a');
    await rm(root, { recursive: true, force: true });
  });
});
