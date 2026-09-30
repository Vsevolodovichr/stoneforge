import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Terminal, X } from 'lucide-react';
import { XTerminal, type TerminalStatus, type XTerminalHandle } from '../terminal/XTerminal';

interface TerminalTab {
  id: string;
  sessionId: string | null;
}

interface WorkspaceTerminalPanelProps {
  workspaceRoot: string | null;
  onClose: () => void;
}

function createTab(): TerminalTab {
  return {
    id: `workspace-terminal-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: null,
  };
}

function getStorageKey(workspaceRoot: string | null): string | null {
  return workspaceRoot ? `editor.workspace-terminals.${workspaceRoot}` : null;
}

function getOwnerToken(workspaceRoot: string | null): string | undefined {
  if (!workspaceRoot) return undefined;
  const key = `editor.workspace-terminal-owner.${workspaceRoot}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, token);
  return token;
}

function loadTabs(workspaceRoot: string | null): TerminalTab[] {
  const key = getStorageKey(workspaceRoot);
  if (!key) return [createTab()];

  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]') as Array<{
      id?: string;
      sessionId?: string | null;
    }>;
    const tabs = stored
      .filter((tab) => typeof tab.id === 'string')
      .map((tab) => ({
        id: tab.id as string,
        sessionId: tab.sessionId ?? null,
      }));
    return tabs.length > 0 ? tabs : [createTab()];
  } catch {
    return [createTab()];
  }
}

export function WorkspaceTerminalPanel({ workspaceRoot, onClose }: WorkspaceTerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>(() => loadTabs(workspaceRoot));
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? '');
  const [status, setStatus] = useState<TerminalStatus>('disconnected');
  const ownerToken = useMemo(() => getOwnerToken(workspaceRoot), [workspaceRoot]);
  const terminalRef = useRef<XTerminalHandle>(null);
  const storageKey = useMemo(() => getStorageKey(workspaceRoot), [workspaceRoot]);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    const nextTabs = loadTabs(workspaceRoot);
    setTabs(nextTabs);
    setActiveTabId(nextTabs[0].id);
  }, [workspaceRoot]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(tabs));
  }, [storageKey, tabs]);

  const handleWorkspaceSession = useCallback(
    (session: { id: string }) => {
      setTabs((currentTabs) => currentTabs.map((tab) => (tab.id === activeTab?.id ? { ...tab, sessionId: session.id } : tab)));
    },
    [activeTab?.id],
  );

  const handleNewTab = useCallback(() => {
    const tab = createTab();
    setTabs((currentTabs) => [...currentTabs, tab]);
    setActiveTabId(tab.id);
  }, []);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTab?.id) {
        terminalRef.current?.closeSession();
      }

      setTabs((currentTabs) => {
        if (currentTabs.length === 1) {
          const replacement = createTab();
          setActiveTabId(replacement.id);
          return [replacement];
        }

        const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
        if (tabId === activeTabId) {
          setActiveTabId(nextTabs[0].id);
        }
        return nextTabs;
      });
    },
    [activeTab?.id, activeTabId],
  );

  return (
    <section
      className="h-72 flex-shrink-0 flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
      data-testid="workspace-terminal-panel"
    >
      <header className="flex h-9 flex-shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab, index) => (
            <div key={tab.id} className="flex items-center">
              <button
                type="button"
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  tab.id === activeTab?.id
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
                onClick={() => setActiveTabId(tab.id)}
                aria-label={`Terminal ${index + 1}`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>{index + 1}</span>
              </button>
              <button
                type="button"
                className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                onClick={() => handleCloseTab(tab.id)}
                aria-label={`Close terminal ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            onClick={handleNewTab}
            aria-label="New terminal"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 pl-2">
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-[var(--color-text-muted)]'
            }`}
          />
          <span className="max-w-64 truncate text-xs text-[var(--color-text-secondary)]" title={workspaceRoot ?? undefined}>
            {workspaceRoot ?? 'Workspace is not available'}
          </span>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            onClick={onClose}
            aria-label="Hide terminal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 bg-[#111827]">
        {workspaceRoot && activeTab ? (
          <XTerminal
            key={activeTab.id}
            ref={terminalRef}
            workspacePath={workspaceRoot}
            workspaceSessionId={activeTab.sessionId ?? undefined}
            workspaceOwnerToken={ownerToken}
            onWorkspaceSession={handleWorkspaceSession}
            onStatusChange={setStatus}
            autoFocus
            data-testid={`workspace-terminal-${activeTab.id}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
            Open a workspace to start a terminal.
          </div>
        )}
      </div>
    </section>
  );
}
