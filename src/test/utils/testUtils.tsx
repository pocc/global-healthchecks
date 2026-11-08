import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with providers
 * Extend this as you add global providers (Router, Theme, etc.)
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options });
}

/**
 * Helper to create mock fetch responses
 */
export function createMockResponse<T>(data: T, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as Response;
}

/**
 * Helper to wait for async operations
 */
export function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to check if element has specific Tailwind class
 */
export function hasTailwindClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Helper to get computed Tailwind classes
 */
export function getTailwindClasses(element: HTMLElement): string[] {
  return Array.from(element.classList);
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalConsole = { ...console };

  return {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    restore: () => {
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.log = originalConsole.log;
    },
  };
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };
export { default as userEvent } from '@testing-library/user-event';

// Import vi for mocking
import { vi } from 'vitest';
