import { describe, expect, it } from 'vitest';
import { translateUserText } from './ukrainian';

describe('Ukrainian interface localization', () => {
  it('translates common UI labels without changing whitespace', () => {
    expect(translateUserText('Dashboard')).toBe('Панель керування');
    expect(translateUserText('  Loading... ')).toBe('  Завантаження… ');
    expect(translateUserText('Created 2 minutes ago')).toBe('Створено 2 minutes ago');
    expect(translateUserText('My Dashboard')).toBe('My Dashboard');
    expect(translateUserText('packages/ui/src/index.ts')).toBe('packages/ui/src/index.ts');
  });

  it('translates previously uncovered route and modal labels', () => {
    expect(translateUserText('Add Pane')).toBe('Додати панель');
    expect(translateUserText('Delete Agent')).toBe('Видалити агента');
    expect(translateUserText('Plan Progress')).toBe('Прогрес плану');
    expect(translateUserText('Private - Only members can see')).toBe('Приватний — лише учасники можуть бачити');
    expect(translateUserText('Workflow not found')).toBe('Робочий процес не знайдено');
  });

  it('translates dynamic loading errors while preserving the detail', () => {
    expect(translateUserText('Failed to load inbox: Network error')).toBe('Не вдалося завантажити вхідні: Network error');
    expect(translateUserText('Failed to load executable paths: Error: HTTP 500')).toBe('Не вдалося завантажити шляхи до виконуваних файлів: HTTP 500');
  });

  it('translates agent defaults settings labels', () => {
    expect(translateUserText('Reset to defaults')).toBe('Скинути до типових');
    expect(translateUserText('Default Provider')).toBe('Типовий провайдер');
    expect(translateUserText('Provider used by default when creating new agents')).toBe('Провайдер, який типово використовується під час створення нових агентів');
    expect(translateUserText('Default Model per Provider')).toBe('Типова модель для кожного провайдера');
    expect(translateUserText('Provider default')).toBe('Типово для провайдера');
    expect(translateUserText('Provider default (Claude Sonnet)')).toBe('Типово для провайдера (Claude Sonnet)');
    expect(translateUserText('These models will be pre-selected when creating agents with the corresponding provider')).toBe('Ці моделі буде попередньо вибрано під час створення агентів із відповідним провайдером');
    expect(translateUserText('Custom Executable Paths')).toBe('Власні шляхи до виконуваних файлів');
    expect(translateUserText('Override the default executable path for each provider. Leave empty to use the system default.')).toBe('Перевизначте типовий шлях до виконуваного файла для кожного провайдера. Залиште поле порожнім, щоб використовувати системний типовий шлях.');
    expect(translateUserText('Loading executable paths...')).toBe('Завантаження шляхів до виконуваних файлів…');
    expect(translateUserText('Loading models...')).toBe('Завантаження моделей…');
    expect(translateUserText('(not installed)')).toBe('(не встановлено)');
  });
});
