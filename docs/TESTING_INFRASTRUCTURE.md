# Testing Infrastructure

## Overview

Comprehensive testing infrastructure using Vitest, React Testing Library, and Mock Service Worker (MSW) for unit, integration, and end-to-end testing.

## Testing Stack

### Core Technologies

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | Latest | Test runner (Vite-native, fast) |
| React Testing Library | Latest | Component testing utilities |
| @testing-library/jest-dom | Latest | Custom DOM matchers |
| @testing-library/user-event | Latest | User interaction simulation |
| MSW | Latest | API mocking (network level) |
| jsdom | Latest | DOM implementation for Node.js |

### Why This Stack?

1. **Vitest**:
   - Native Vite integration (same config)
   - Blazing fast (ESM-first)
   - Compatible with Jest API
   - Built-in TypeScript support

2. **React Testing Library**:
   - Encourages accessibility-first testing
   - Tests behavior, not implementation
   - User-centric queries
   - Excellent TypeScript support

3. **MSW**:
   - Intercepts requests at network level
   - Works in Node.js and browser
   - No mocking fetch/axios
   - Same handlers for dev and test

## Testing Philosophy

### Testing Principles

1. **Test User Behavior**: Focus on what users see and do
2. **Avoid Implementation Details**: Don't test internal state
3. **Accessibility First**: Use semantic queries (role, label)
4. **Confidence Over Coverage**: 100% coverage ≠ bug-free code
5. **Fast Feedback**: Tests should run in milliseconds

### Testing Pyramid

```
        /\
       /E2E\          (Few)
      /------\
     /  API   \       (Some)
    /----------\
   /   Unit     \     (Many)
  /--------------\
```

- **Unit Tests**: 70% - Components, functions, utilities
- **Integration Tests**: 25% - Component + API interactions
- **E2E Tests**: 5% - Critical user flows (future)

## Test Structure

### Directory Organization

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx              # Co-located with component
├── App.tsx
├── App.test.tsx                     # (Future)
└── test/
    ├── setupTests.ts                # Global setup
    ├── vitest.d.ts                  # Type definitions
    ├── README.md                    # Testing guide
    ├── mocks/
    │   ├── handlers.ts              # MSW request handlers
    │   ├── server.ts                # MSW Node.js server
    │   └── browser.ts               # MSW browser worker
    ├── utils/
    │   └── testUtils.tsx            # Custom utilities
    └── integration/
        └── healthCheck.test.tsx     # API integration tests
```

### Naming Conventions

- **Test Files**: `*.test.tsx` or `*.test.ts`
- **Test Suites**: `describe('ComponentName', ...)`
- **Test Cases**: `it('should do something', ...)`
- **Setup Files**: `setup*.ts`
- **Mock Files**: `*.mock.ts` or in `mocks/` directory

## Configuration

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    globals: true,                    // No import { it, expect }
    environment: 'jsdom',             // DOM for React
    setupFiles: './src/test/setupTests.ts',
    css: true,                        // Process CSS imports
    coverage: {
      provider: 'v8',                 // Fast coverage
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### setupTests.ts

```typescript
// 1. Extend matchers
expect.extend(matchers);

// 2. MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 3. Cleanup
afterEach(() => cleanup());

// 4. Mock globals
Object.defineProperty(window, 'matchMedia', { ... });
```

## Test Categories

### 1. Unit Tests

Test individual components in isolation.

**Example: Button Component**

```typescript
describe('Button', () => {
  describe('Rendering', () => {
    it('should render with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('should apply variant classes', () => {
      render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-orange-500');
    });
  });

  describe('User Interactions', () => {
    it('should handle clicks', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={onClick}>Click</Button>);
      await user.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have button role', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should support aria attributes', () => {
      render(<Button aria-label="Close">×</Button>);
      expect(screen.getByRole('button', { name: /close/i }))
        .toBeInTheDocument();
    });
  });
});
```

### 2. Integration Tests

Test component interactions with APIs.

**Example: Health Check Form**

```typescript
describe('Health Check API Integration', () => {
  it('should fetch and display results', async () => {
    const user = userEvent.setup();
    render(<HealthCheckForm />);

    // User fills form
    await user.type(screen.getByLabelText(/host/i), 'example.com');
    await user.type(screen.getByLabelText(/port/i), '443');

    // User submits
    await user.click(screen.getByRole('button', { name: /check/i }));

    // Wait for result
    await waitFor(() => {
      expect(screen.getByText(/success!/i)).toBeInTheDocument();
      expect(screen.getByText(/latency: 45ms/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    server.use(
      http.post('/api/check', () => HttpResponse.error())
    );

    const user = userEvent.setup();
    render(<HealthCheckForm />);

    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });
});
```

### 3. Tailwind Class Tests

Verify CSS classes are applied correctly.

```typescript
describe('Tailwind Class Verification', () => {
  it('should have background color', () => {
    render(<Button variant="primary">Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-orange-500');
  });

  it('should have hover state', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-orange-600');
  });

  it('should have transitions', () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('transition-all');
    expect(button).toHaveClass('duration-200');
  });

  it('should have focus ring', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('focus:ring-2');
  });
});
```

### 4. Snapshot Tests

Capture component output for regression testing.

```typescript
describe('Snapshots', () => {
  it('should match primary button snapshot', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('should match loading state snapshot', () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

**Updating Snapshots**:
```bash
npm run test:run -- -u
```

## MSW (Mock Service Worker)

### Handler Definition

```typescript
// src/test/mocks/handlers.ts
export const handlers = [
  http.post('/api/check', async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      host: body.host,
      port: body.port,
      latencyMs: 45,
      timestamp: Date.now(),
      cfRay: 'mock-ray-123',
      colo: 'SFO',
    });
  }),
];
```

### Server Setup

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Per-Test Overrides

```typescript
it('should handle timeout error', async () => {
  // Override handler for this test only
  server.use(
    http.post('/api/check', () => {
      return HttpResponse.json(
        { success: false, error: 'Connection timeout' },
        { status: 200 }
      );
    })
  );

  // Test error handling...
});
```

### Browser Worker (Optional)

```typescript
// src/test/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Enable in development
if (process.env.NODE_ENV === 'development') {
  worker.start();
}
```

## Test Utilities

### Custom Render

```typescript
// src/test/utils/testUtils.tsx
import { render } from '@testing-library/react';

export function customRender(
  ui: ReactElement,
  options?: RenderOptions
) {
  // Wrap with providers as needed
  return render(ui, { ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```

### Helper Functions

```typescript
// Check Tailwind class
export function hasTailwindClass(
  element: HTMLElement,
  className: string
): boolean {
  return element.classList.contains(className);
}

// Mock console
export function mockConsole() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    restore: () => { /* ... */ },
  };
}

// Create mock response
export function createMockResponse<T>(
  data: T,
  ok = true,
  status = 200
): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}
```

## Testing Best Practices

### Query Priority

1. **Accessible Queries** (Best)
   - `getByRole`
   - `getByLabelText`
   - `getByPlaceholderText`
   - `getByText`

2. **Semantic Queries** (Good)
   - `getByAltText`
   - `getByTitle`

3. **Test IDs** (Last Resort)
   - `getByTestId`

```typescript
// ✅ Good - accessible
screen.getByRole('button', { name: /submit/i });

// ⚠️ Okay - semantic
screen.getByAltText('User avatar');

// ❌ Avoid - implementation detail
screen.getByTestId('submit-button');
```

### Async Testing

```typescript
// ✅ Use waitFor for async updates
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});

// ✅ Use findBy queries (built-in waitFor)
expect(await screen.findByText(/loaded/i)).toBeInTheDocument();

// ❌ Don't use arbitrary delays
await new Promise(resolve => setTimeout(resolve, 1000));
```

### User Interactions

```typescript
// ✅ Use userEvent (realistic)
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
await user.keyboard('{Enter}');

// ❌ Avoid fireEvent (synthetic)
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'text' } });
```

### Mocking

```typescript
// ✅ Mock functions
const onClick = vi.fn();
render(<Button onClick={onClick}>Click</Button>);
expect(onClick).toHaveBeenCalled();

// ✅ Mock modules
vi.mock('./api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'mocked' })),
}));

// ❌ Don't mock React internals
// (e.g., useState, useEffect)
```

## Coverage Reports

### Generate Coverage

```bash
npm run test:coverage
```

### View HTML Report

```bash
open coverage/index.html
```

### Coverage Thresholds

```typescript
// vite.config.ts
coverage: {
  thresholds: {
    statements: 80,  // 80% of statements covered
    branches: 75,    // 75% of branches covered
    functions: 80,   // 80% of functions covered
    lines: 80,       // 80% of lines covered
  },
}
```

### Exclude from Coverage

```typescript
coverage: {
  exclude: [
    'node_modules/',
    'src/test/',           // Test utilities
    '**/*.d.ts',           // Type definitions
    '**/*.config.*',       // Config files
    'dist/',               // Build output
  ],
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/coverage-final.json
```

### Pre-commit Hooks (Optional)

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:run"
    }
  }
}
```

## Debugging Tests

### Print DOM

```typescript
import { screen } from '@testing-library/react';

screen.debug();           // Print entire DOM
screen.debug(element);    // Print specific element
```

### Run Single Test

```typescript
it.only('should run only this test', () => {
  // Only this test will run
});
```

### Skip Test

```typescript
it.skip('should skip this test', () => {
  // This test will be skipped
});
```

### Vitest UI

```bash
npm run test:ui
```

Opens browser at `http://localhost:51204/__vitest__/`

### Test Filtering

```bash
# Run tests matching pattern
npm test Button

# Run tests in specific file
npm test Button.test.tsx

# Run tests in watch mode
npm test -- --watch
```

## Performance

### Test Execution Speed

- **Button.test.tsx**: ~200ms (30+ tests)
- **healthCheck.test.tsx**: ~150ms (integration tests)
- **Total Suite**: <1 second

### Optimization Tips

1. **Parallel Execution**: Vitest runs tests in parallel by default
2. **Fast Matchers**: Use `toBeInTheDocument()` over `toBeTruthy()`
3. **Avoid Sleep**: Use `waitFor()` instead of `setTimeout()`
4. **MSW Caching**: Reuse handlers across tests
5. **Cleanup**: Automatic cleanup prevents memory leaks

## Test Metrics

### Current Coverage (Button Component)

- **Statements**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Lines**: 100%

### Test Count

- **Unit Tests**: 30+
- **Integration Tests**: 6+
- **Total Tests**: 36+

### Test Distribution

- Rendering: 8 tests
- Tailwind Classes: 5 tests
- User Interactions: 4 tests
- Accessibility: 7 tests
- Loading States: 3 tests
- Snapshots: 6 tests
- HTML Attributes: 2 tests
- API Integration: 6 tests

---

**Testing Infrastructure Version**: 1.0
**Last Updated**: February 7, 2026
