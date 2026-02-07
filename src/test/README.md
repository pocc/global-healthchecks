# Testing Documentation

## Overview

This project uses **Vitest** as the test runner and **React Testing Library** for component testing, with **MSW (Mock Service Worker)** for API mocking.

## Running Tests

```bash
# Run tests in watch mode (interactive)
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (explicit)
npm run test:watch
```

## Directory Structure

```
src/test/
├── README.md                    # This file
├── setupTests.ts                # Global test setup
├── vitest.d.ts                  # TypeScript definitions
├── mocks/
│   ├── handlers.ts              # MSW request handlers
│   ├── server.ts                # MSW server (Node.js)
│   └── browser.ts               # MSW worker (Browser)
├── utils/
│   └── testUtils.tsx            # Custom test utilities
└── integration/
    └── healthCheck.test.tsx     # API integration tests
```

## Test Categories

### 1. Unit Tests

Test individual components in isolation.

**Example**: `Button.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

it('should render button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### 2. Integration Tests

Test component interactions with APIs and services.

**Example**: `healthCheck.test.tsx`

```tsx
it('should fetch health check data', async () => {
  render(<HealthCheckForm />);
  await user.click(screen.getByRole('button'));
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

### 3. Tailwind Class Testing

Verify Tailwind CSS classes are applied correctly.

```tsx
it('should have bg-blue-500 class', () => {
  render(<Button variant="primary">Test</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-orange-500');
});
```

### 4. Accessibility Testing

Test ARIA attributes and keyboard interactions.

```tsx
it('should be accessible', () => {
  render(<Button aria-label="Close">×</Button>);
  const button = screen.getByRole('button', { name: /close/i });
  expect(button).toBeInTheDocument();
});
```

### 5. Snapshot Testing

Capture component output for regression testing.

```tsx
it('should match snapshot', () => {
  const { container } = render(<Button>Test</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
```

## MSW API Mocking

### Setup

MSW is configured in `setupTests.ts` and starts automatically before all tests.

### Adding Mock Handlers

Edit `src/test/mocks/handlers.ts`:

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

### Overriding Handlers in Tests

```typescript
import { server } from './mocks/server';
import { http, HttpResponse } from 'msw';

it('should handle errors', async () => {
  server.use(
    http.post('/api/check', () => {
      return HttpResponse.json({ error: 'Failed' }, { status: 500 });
    })
  );
  // Test error handling...
});
```

## Custom Test Utilities

Import from `src/test/utils/testUtils.tsx`:

```typescript
import { render, screen, userEvent } from '@/test/utils/testUtils';

// Custom render with providers
render(<MyComponent />);

// Check Tailwind classes
expect(hasTailwindClass(element, 'hidden')).toBe(true);

// Mock console
const consoleMock = mockConsole();
// ... run tests ...
consoleMock.restore();
```

## Best Practices

### 1. Query Priority

Use queries in this order (from most to least preferred):

1. **Accessible queries**: `getByRole`, `getByLabelText`, `getByPlaceholderText`
2. **Semantic queries**: `getByAltText`, `getByTitle`
3. **Test IDs**: `getByTestId` (last resort)

```tsx
// ✅ Good - accessible
screen.getByRole('button', { name: /submit/i });

// ❌ Avoid - implementation detail
screen.getByTestId('submit-btn');
```

### 2. User Interactions

Use `userEvent` instead of `fireEvent`:

```tsx
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### 3. Async Testing

Always `await` async operations:

```tsx
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});
```

### 4. Tailwind Class Testing

Test meaningful classes, not all classes:

```tsx
// ✅ Test important classes
expect(button).toHaveClass('bg-orange-500');
expect(button).toHaveClass('disabled:opacity-50');

// ❌ Don't test every utility class
expect(button).toHaveClass('px-4 py-2 text-sm font-medium...');
```

### 5. Mocking

Keep mocks close to the test:

```tsx
// ✅ Mock in the test file
const mockFn = vi.fn();

// ❌ Avoid global mocks unless necessary
```

## Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

View coverage report:

```bash
npm run test:coverage
open coverage/index.html
```

## Common Patterns

### Testing Form Submission

```tsx
it('should submit form', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<Form onSubmit={handleSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(handleSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
});
```

### Testing Loading States

```tsx
it('should show loading state', async () => {
  render(<AsyncComponent />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.getByText(/data loaded/i)).toBeInTheDocument();
  });
});
```

### Testing Error States

```tsx
it('should show error message', async () => {
  server.use(
    http.get('/api/data', () => HttpResponse.error())
  );

  render(<DataComponent />);

  await waitFor(() => {
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
  });
});
```

## Debugging Tests

### 1. View Rendered HTML

```tsx
import { screen } from '@testing-library/react';

screen.debug(); // Prints entire DOM
screen.debug(element); // Prints specific element
```

### 2. Use Vitest UI

```bash
npm run test:ui
```

Open browser at `http://localhost:51204/__vitest__/`

### 3. Run Single Test

```tsx
it.only('should test this one', () => {
  // Only this test will run
});
```

### 4. Skip Tests

```tsx
it.skip('should skip this test', () => {
  // This test will be skipped
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [MSW Documentation](https://mswjs.io/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
