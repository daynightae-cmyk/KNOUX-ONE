// @vitest-environment jsdom

import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { KnouxProvider, useKnoux } from '../context/KnouxContext';

let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.innerHTML = '';
  localStorage.clear();
});

function PreferArabicLight() {
  const { setLanguage, setTheme } = useKnoux();
  useEffect(() => {
    setLanguage('ar');
    setTheme('light');
  }, []);
  return null;
}

describe('accessibility smoke', () => {
  it('sets document lang and dir to Arabic/RTL when the user chooses Arabic', async () => {
    await act(() => {
      root.render(
        <KnouxProvider>
          <PreferArabicLight />
        </KnouxProvider>,
      );
    });
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('defaults to English and LTR with no stored preference', async () => {
    await act(() => {
      root.render(<KnouxProvider />);
    });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
