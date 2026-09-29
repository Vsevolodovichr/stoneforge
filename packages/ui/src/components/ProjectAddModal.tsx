/**
 * ProjectAddModal - Modal dialog for adding a new project
 *
 * Provides a user-friendly interface for adding projects with:
 * - Directory path input with browse button
 * - Real-time validation
 * - Optional name, description, and tags
 * - Visual validation status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  FolderOpen,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Info,
} from 'lucide-react';
import {
  pickProjectDirectory,
  validateProjectPath,
  extractProjectName,
  normalizePath,
  type ValidationResult,
} from '../utils/projectValidation';

const PROJECT_ERROR_TRANSLATIONS: Record<string, string> = {
  'Path is required': 'Шлях обов’язковий',
  'path is required': 'Шлях обов’язковий',
  'Directory does not exist': 'Каталог не існує',
  '.stoneforge directory not found': 'Каталог .stoneforge не знайдено',
  'config.yaml not found in .stoneforge': 'config.yaml у каталозі .stoneforge не знайдено',
  'Validation failed': 'Не вдалося виконати перевірку',
  'Failed to register project': 'Не вдалося зареєструвати проєкт',
  'Project not found': 'Проєкт не знайдено',
  'No active project': 'Немає активного проєкту',
};

function localizeProjectError(message: string): string {
  if (message.includes('Local connector is unavailable')) {
    return 'Локальний конектор недоступний. Запустіть локальний Quarry-сервер.';
  }
  if (message.includes('Directory picker is unavailable')) {
    return 'Вибір каталогу недоступний на локальному сервері.';
  }
  if (message.includes('already registered')) return 'Проєкт уже зареєстровано';
  if (message.includes('already exists')) return 'Проєкт уже існує';

  const prefix = 'Failed to register project: ';
  if (message.startsWith(prefix)) return PROJECT_ERROR_TRANSLATIONS['Failed to register project'];

  const localizedMessage = PROJECT_ERROR_TRANSLATIONS[message];
  if (localizedMessage) return localizedMessage;
  if (/[А-Яа-яІіЇїЄєҐґ]/.test(message)) return message;

  return 'Не вдалося виконати операцію. Спробуйте ще раз.';
}

export interface ProjectAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (project: {
    path: string;
    name?: string;
    description?: string;
    tags?: string[];
  }) => Promise<void>;
  initialPath?: string;
}

export function ProjectAddModal({
  isOpen,
  onClose,
  onAdd,
  initialPath = '',
}: ProjectAddModalProps) {
  const [path, setPath] = useState(initialPath);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPath(initialPath);
      setName('');
      setDescription('');
      setTags('');
      setValidation(null);
      setIsPicking(false);
      setError(null);
    }
  }, [isOpen, initialPath]);

  // Validate path when it changes
  useEffect(() => {
    if (!path || !path.trim()) {
      setValidation(null);
      return;
    }

    const normalizedPath = normalizePath(path.trim());
    if (!normalizedPath) {
      setValidation(null);
      return;
    }

    let cancelled = false;
    setIsValidating(true);

    validateProjectPath(normalizedPath).then((result) => {
      if (!cancelled) {
        setValidation(result);
        setIsValidating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const handlePathChange = useCallback((newPath: string) => {
    setPath(newPath);
    setError(null);
  }, []);

  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
  }, []);

  const handleDescriptionChange = useCallback((newDescription: string) => {
    setDescription(newDescription);
  }, []);

  const handleTagsChange = useCallback((newTags: string) => {
    setTags(newTags);
  }, []);

  const handleBrowse = useCallback(async () => {
    setIsPicking(true);
    setError(null);

    try {
      const selectedPath = await pickProjectDirectory();
      if (selectedPath) {
        handlePathChange(selectedPath);
      }
    } catch (browseError) {
      setError(browseError instanceof Error ? localizeProjectError(browseError.message) : 'Не вдалося вибрати каталог');
    } finally {
      setIsPicking(false);
    }
  }, [handlePathChange]);

  const handleSubmit = async () => {
    if (!path || !path.trim()) {
      setError('Шлях обов’язковий');
      return;
    }

    if (validation && !validation.isValid) {
      setError('Виправте помилки перевірки перед додаванням');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const normalizedPath = normalizePath(path.trim());
      const projectName = name.trim() || extractProjectName(normalizedPath);
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onAdd({
        path: normalizedPath,
        name: projectName,
        description: description.trim() || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? localizeProjectError(err.message) : 'Не вдалося додати проєкт');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const canSubmit = path.trim() && validation?.isValid && !isValidating && !isPicking && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-bg)] rounded-xl shadow-2xl border border-[var(--color-border)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-add-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-primary-muted)]">
              <FolderOpen className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <h2 id="project-add-title" className="text-lg font-semibold text-[var(--color-text)]">Додати проєкт</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
            aria-label="Закрити діалог додавання проєкту"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Path Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              Каталог проєкту <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder="/шлях/до/stoneforge/проєкту"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                autoFocus
              />
              <button
                type="button"
                onClick={handleBrowse}
                disabled={isPicking || isSubmitting}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
              >
                {isPicking ? 'Відкриття...' : 'Огляд...'}
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Шлях має містити каталог .stoneforge із файлом config.yaml
            </p>
          </div>

          {/* Validation Status */}
          {isValidating && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Перевірка...
            </div>
          )}

          {validation && !isValidating && (
            <div className="space-y-2 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                {validation.isValid ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {validation.isValid ? 'Коректний проєкт' : 'Некоректний проєкт'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  {validation.hasDirectory ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[var(--color-text-secondary)]">Каталог існує</span>
                </div>
                <div className="flex items-center gap-2">
                  {validation.hasStoneforge ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[var(--color-text-secondary)]">Каталог .stoneforge знайдено</span>
                </div>
                <div className="flex items-center gap-2">
                  {validation.hasConfig ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-[var(--color-text-secondary)]">config.yaml знайдено</span>
                </div>
              </div>
              {validation.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-500">{localizeProjectError(err)}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              Назва проєкту <span className="text-[var(--color-text-tertiary)]">(необов’язково)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={path ? extractProjectName(path) : 'Мій проєкт'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Якщо не вказано, використовується назва каталогу
            </p>
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              Опис <span className="text-[var(--color-text-tertiary)]">(необов’язково)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Опис проєкту..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
            />
          </div>

          {/* Tags Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              Теги <span className="text-[var(--color-text-tertiary)]">(необов’язково)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="тег1, тег2, тег3"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Розділяйте теги комами
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Каталог проєкту має містити папку .stoneforge із файлом config.yaml.
              Використайте <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40">sf init</code>, щоб створити новий проєкт.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-lg"
          >
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Додавання...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Додати проєкт
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
