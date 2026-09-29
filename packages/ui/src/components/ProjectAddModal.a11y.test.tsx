import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { ProjectAddModal } from './ProjectAddModal';

describe('ProjectAddModal accessibility', () => {
  test('renders dialog semantics and an accessible close control', () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectAddModal, {
        isOpen: true,
        onAdd: async () => {},
        onClose: () => {},
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="project-add-title"');
    expect(markup).toContain('aria-label="Закрити діалог додавання проєкту"');
    expect(markup).toContain('Додати проєкт');
  });
});
