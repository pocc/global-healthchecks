# Testing Suite Documentation

## 🎯 Overview

This project uses a modern, robust testing stack:

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, Vite-native test runner
- **Component Testing**: [React Testing Library](https://testing-library.com/react) - User-centric testing utilities
- **API Mocking**: [MSW (Mock Service Worker)](https://mswjs.io/) - Seamless API mocking
- **Coverage**: V8 coverage provider
- **Type Safety**: Full TypeScript support

## 📦 Installation

Run the following command to install all testing dependencies:

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw@latest
```

## 🚀 Quick Start

### Run Tests

```bash
# Watch mode (development)
npm test

# Single run (CI)
npm run test:run

# With UI dashboard
npm run test:ui

# With coverage report
npm run test:coverage
```

### Write Your First Test

Create `MyComponent.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render successfully', () => {
    render(<MyComponent />);
    expect(screen.getByText(/hello/i)).toBeInTheDocument();
  });
});
```

## 📁 Project Structure

```
global-healthchecks/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx          # Component tests
│   ├── test/
│   │   ├── setupTests.ts             # Global test setup
│   │   ├── vitest.d.ts               # Type definitions
│   │   ├── README.md                 # Detailed testing guide
│   │   ├── mocks/
│   │   │   ├── handlers.ts           # MSW handlers
│   │   │   ├── server.ts             # MSW Node server
│   │   │   └── browser.ts            # MSW browser worker
│   │   ├── utils/
│   │   │   └── testUtils.tsx         # Custom utilities
│   │   └── integration/
│   │       └── healthCheck.test.tsx  # Integration tests
├── vite.config.ts                    # Includes Vitest config
├── package.json                      # Test scripts
└── TESTING.md                        # This file
```

## 🧪 Testing Features

### 1. Component Testing

The `Button` component demonstrates comprehensive testing:

**[Button.tsx](src/components/Button.tsx)** - Full-featured button component with:
- Multiple variants (primary, secondary, danger)
- Size options (sm, md, lg)
- Loading states
- Accessibility support

**[Button.test.tsx](src/components/Button.test.tsx)** - 30+ test cases covering:
- ✅ Rendering different variants and sizes
- ✅ Tailwind CSS class verification
- ✅ User interactions (click, keyboard)
- ✅ Accessibility (ARIA, roles, focus)
- ✅ Loading states
- ✅ Snapshot testing
- ✅ HTML attribute forwarding

**Example Test**:
```tsx
it('should apply primary variant classes', () => {
  render(<Button variant="primary">Click</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-orange-500');
  expect(button).toHaveClass('hover:bg-orange-600');
});
```

### 2. Tailwind Class Verification

Specific tests verify Tailwind classes are applied correctly:

```tsx
describe('Tailwind Class Verification', () => {
  it('should have rounded-md class', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('rounded-md');
  });

  it('should have transition classes', () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('transition-all');
    expect(button).toHaveClass('duration-200');
  });

  it('should have focus ring for accessibility', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-2');
  });
});
```

### 3. API Mocking with MSW

MSW intercepts network requests at the network level (no monkey patching):

**[handlers.ts](src/test/mocks/handlers.ts)** - Define mock API responses:
```typescript
export const handlers = [
  http.post('/api/check', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      host: body.host,
      latencyMs: 45,
    });
  }),
];
```

**[healthCheck.test.tsx](src/test/integration/healthCheck.test.tsx)** - Integration tests:
```tsx
it('should fetch health check data', async () => {
  const user = userEvent.setup();
  render(<HealthCheckForm />);

  await user.click(screen.getByRole('button'));

  await waitFor(() => {
    expect(screen.getByText(/success!/i)).toBeInTheDocument();
    expect(screen.getByText(/latency: 45ms/i)).toBeInTheDocument();
  });
});
```

### 4. User Interactions

Tests use `@testing-library/user-event` for realistic user interactions:

```tsx
it('should handle click events', async () => {
  const handleClick = vi.fn();
  const user = userEvent.setup();

  render(<Button onClick={handleClick}>Click</Button>);
  await user.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalledTimes(1);
});

it('should handle keyboard events', async () => {
  const handleClick = vi.fn();
  const user = userEvent.setup();

  render(<Button onClick={handleClick}>Press</Button>);

  screen.getByRole('button').focus();
  await user.keyboard('{Enter}');

  expect(handleClick).toHaveBeenCalled();
});
```

### 5. Accessibility Testing

Every test uses semantic queries (by role, label) instead of test IDs:

```tsx
it('should have button role', () => {
  render(<Button>Test</Button>);
  expect(screen.getByRole('button')).toBeInTheDocument();
});

it('should have aria-busy when loading', () => {
  render(<Button loading>Test</Button>);
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
});

it('should support screen readers', () => {
  render(<Button loading>Test</Button>);
  const svg = screen.getByRole('button').querySelector('svg');
  expect(svg).toHaveAttribute('aria-hidden', 'true');
});
```

### 6. Snapshot Testing

Capture component output for regression testing:

```tsx
it('should match snapshot for primary button', () => {
  const { container } = render(<Button>Primary</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
```

Update snapshots when changes are intentional:
```bash
npm run test:run -- -u
```

## 🎨 Configuration Files

### [vite.config.ts](vite.config.ts)

Vitest configuration with:
- jsdom environment for DOM testing
- Coverage reporting (V8 provider)
- Global test setup
- CSS support

```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setupTests.ts',
  css: true,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
  },
}
```

### [setupTests.ts](src/test/setupTests.ts)

Global test setup including:
- jest-dom matchers (toBeInTheDocument, toHaveClass, etc.)
- MSW server lifecycle (start, reset, stop)
- window.matchMedia mock for responsive tests
- Automatic cleanup after each test

## 📊 Coverage Reports

Generate coverage reports:

```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

Coverage thresholds:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## 🔧 Custom Utilities

**[testUtils.tsx](src/test/utils/testUtils.tsx)** provides:

- `render()` - Custom render with providers
- `createMockResponse()` - Mock fetch responses
- `hasTailwindClass()` - Check Tailwind classes
- `mockConsole()` - Mock console methods
- Re-exports all RTL utilities

Example:
```tsx
import { render, screen, userEvent } from '@/test/utils/testUtils';
```

## 🤖 CI/CD Integration

**[.github/workflows/test.yml](.github/workflows/test.yml)** runs tests on:
- Push to main/develop
- Pull requests
- Multiple Node.js versions (18.x, 20.x)

Steps:
1. Checkout code
2. Install dependencies
3. Run type check (`tsc --noEmit`)
4. Run tests
5. Generate coverage
6. Upload to Codecov
7. Build project

## 📚 Best Practices

### 1. Query Priority

```tsx
// ✅ Accessible (best)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)

// ⚠️ Semantic (okay)
screen.getByAltText('Profile picture')

// ❌ Test ID (last resort)
screen.getByTestId('submit-btn')
```

### 2. Async Operations

```tsx
// ✅ Use waitFor for async updates
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});

// ❌ Don't use arbitrary timeouts
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 3. User Interactions

```tsx
// ✅ Use userEvent
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');

// ❌ Avoid fireEvent
fireEvent.click(button);
```

### 4. Test Organization

```tsx
describe('ComponentName', () => {
  describe('Rendering', () => {
    it('should render...', () => {});
  });

  describe('User Interactions', () => {
    it('should handle click...', () => {});
  });

  describe('Accessibility', () => {
    it('should have role...', () => {});
  });
});
```

## 🐛 Debugging

### Print Rendered HTML

```tsx
screen.debug(); // Entire DOM
screen.debug(element); // Specific element
```

### Run Single Test

```tsx
it.only('should run only this test', () => {
  // ...
});
```

### Skip Test

```tsx
it.skip('should skip this test', () => {
  // ...
});
```

### Vitest UI

```bash
npm run test:ui
```

Opens interactive dashboard at `http://localhost:51204/__vitest__/`

## 📖 Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [MSW Documentation](https://mswjs.io/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Best Practices](https://testingjavascript.com/)

## 🎓 Example Test Files

1. **[Button.test.tsx](src/components/Button.test.tsx)** - Component unit tests (30+ test cases)
2. **[healthCheck.test.tsx](src/test/integration/healthCheck.test.tsx)** - API integration tests with MSW
3. **[testUtils.tsx](src/test/utils/testUtils.tsx)** - Custom testing utilities

## ✅ Test Checklist

When writing tests, ensure you cover:

- [ ] Component renders without crashing
- [ ] Props are handled correctly
- [ ] User interactions work (clicks, typing, etc.)
- [ ] Accessibility (ARIA, roles, keyboard navigation)
- [ ] Loading states
- [ ] Error states
- [ ] Edge cases (empty data, errors, etc.)
- [ ] Tailwind classes for visual regressions
- [ ] Snapshots for complex components

---

**Happy Testing! 🎉**

For detailed testing patterns and examples, see [src/test/README.md](src/test/README.md)
