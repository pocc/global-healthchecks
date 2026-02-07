# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: 18.x or 20.x
- **npm**: 9.x or later
- **Git**: 2.x or later
- **Cloudflare Account**: With Workers paid plan (for Sockets API)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/pocc/global-healthchecks.git
cd global-healthchecks

# Install dependencies
npm install

# Install testing dependencies
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw@latest
```

## Development Workflow

### Local Development

```bash
# Start React development server (Vite)
npm run dev
# Opens http://localhost:5173

# Or run Cloudflare Worker locally
npm run dev:worker
# Opens http://localhost:8787
```

### Running Tests

```bash
# Interactive watch mode
npm test

# Single run (CI mode)
npm run test:run

# With UI dashboard
npm run test:ui

# With coverage report
npm run test:coverage
```

### Building

```bash
# Type check
npx tsc --noEmit

# Build production bundle
npm run build

# Preview production build
npm run preview
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or via Wrangler directly
npx wrangler deploy
```

## Project Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start Vite dev server |
| `build` | `tsc && vite build` | Build production bundle |
| `preview` | `vite preview` | Preview production build |
| `deploy` | `wrangler deploy` | Deploy to Cloudflare |
| `dev:worker` | `wrangler dev` | Local worker development |
| `cf-typegen` | `wrangler types` | Generate CF types |
| `test` | `vitest` | Run tests (watch mode) |
| `test:ui` | `vitest --ui` | Test UI dashboard |
| `test:run` | `vitest run` | Run tests (CI mode) |
| `test:coverage` | `vitest run --coverage` | Coverage report |
| `test:watch` | `vitest --watch` | Explicit watch mode |

## Code Organization

### File Structure

```
src/
├── components/          # Reusable React components
│   ├── Button.tsx
│   └── Button.test.tsx
├── test/               # Testing infrastructure
│   ├── setupTests.ts
│   ├── mocks/
│   ├── utils/
│   └── integration/
├── worker.ts           # Cloudflare Worker entry point
├── App.tsx             # Main React component
├── App.css             # Application styles
├── main.tsx            # React entry point
├── index.css           # Global styles
└── vite-env.d.ts       # Vite type definitions
```

### Import Organization

```typescript
// 1. External dependencies
import { useState } from 'react';

// 2. Internal components
import { Button } from './components/Button';

// 3. Types
import type { HealthCheckResult } from './types';

// 4. Styles
import './App.css';
```

## Coding Standards

### TypeScript

```typescript
// ✅ Use explicit types for function parameters
function testPort(host: string, port: number): Promise<Result> {
  // ...
}

// ✅ Use interfaces for objects
interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
}

// ✅ Avoid `any` - use `unknown` if type is truly unknown
const data: unknown = await response.json();

// ✅ Use type guards
if (typeof data === 'object' && data !== null) {
  // ...
}
```

### React Components

```typescript
// ✅ Use function components with TypeScript
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}

// ✅ Destructure props
// ✅ Provide default values
// ✅ Export named components (not default)
```

### State Management

```typescript
// ✅ Use descriptive state names
const [isLoading, setIsLoading] = useState(false);

// ✅ Initialize with correct type
const [result, setResult] = useState<HealthCheckResult | null>(null);

// ✅ Update state correctly
setResult(prev => ({ ...prev, newField: value }));
```

### Event Handlers

```typescript
// ✅ Prefix with 'handle'
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  // ...
};

// ✅ Use async/await for async operations
const handleCheck = async () => {
  try {
    const result = await fetchHealthCheck();
    setResult(result);
  } catch (error) {
    handleError(error);
  }
};
```

### CSS/Styling

```typescript
// ✅ Use CSS custom properties for theming
:root {
  --primary: #f38020;
  --text: #f1f5f9;
}

// ✅ Use Tailwind classes inline
<button className="px-4 py-2 bg-orange-500 rounded-md">

// ✅ Combine with conditional classes
className={`base-class ${variant === 'primary' ? 'bg-orange-500' : 'bg-gray-500'}`}
```

## Testing Guidelines

### Test File Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component } from './Component';

describe('Component', () => {
  describe('Rendering', () => {
    it('should render correctly', () => {
      // ...
    });
  });

  describe('User Interactions', () => {
    it('should handle clicks', async () => {
      // ...
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      // ...
    });
  });
});
```

### Writing Tests

```typescript
// ✅ Use accessible queries
screen.getByRole('button', { name: /submit/i });

// ✅ Test user behavior, not implementation
await user.click(screen.getByRole('button'));
expect(screen.getByText(/success/i)).toBeInTheDocument();

// ✅ Use waitFor for async
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});

// ✅ Clean up side effects
afterEach(() => {
  cleanup();
});
```

## Git Workflow

### Branch Strategy

```
main          # Production branch (protected)
  ↓
feature/*     # Feature branches
bugfix/*      # Bug fix branches
hotfix/*      # Urgent fixes
```

### Commit Messages

```bash
# Format: type(scope): subject

feat(api): add batch health check endpoint
fix(ui): correct loading state display
test(button): add accessibility tests
docs(readme): update installation instructions
refactor(worker): simplify error handling
chore(deps): update dependencies
```

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `test`: Add/update tests
- `docs`: Documentation
- `refactor`: Code refactoring
- `style`: Code style (formatting)
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Pull Request Process

1. **Create branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Follow coding standards
3. **Write tests**: Ensure coverage
4. **Run tests**: `npm run test:run`
5. **Type check**: `npx tsc --noEmit`
6. **Commit**: Use conventional commits
7. **Push**: `git push -u origin feature/my-feature`
8. **Create PR**: On GitHub
9. **Review**: Address feedback
10. **Merge**: Squash and merge

## Debugging

### Browser DevTools

```typescript
// Add breakpoints in source
debugger;

// Console logging
console.log('Debug:', { host, port, result });

// React DevTools
// Install extension for component inspection
```

### Vite Dev Server

```bash
# Enable debug mode
DEBUG=vite:* npm run dev

# Network requests
# Open browser DevTools > Network tab
```

### Wrangler Local Dev

```bash
# Local worker with --inspect
npx wrangler dev --inspect

# View logs
# Check terminal output
```

### Test Debugging

```typescript
// Print rendered DOM
import { screen } from '@testing-library/react';
screen.debug();

// Run single test
it.only('should debug this test', () => {
  // ...
});

// Vitest UI
npm run test:ui
```

## Common Issues

### Issue: MSW handlers not working

**Solution**:
```typescript
// Ensure server is started in setupTests.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Issue: TypeScript errors with connect()

**Solution**:
```typescript
// Add declaration in worker.ts
declare function connect(
  address: { hostname: string; port: number },
  options?: { secureTransport?: string; allowHalfOpen?: boolean }
): Socket;
```

### Issue: Test timeout errors

**Solution**:
```typescript
// Increase timeout
await waitFor(() => {
  expect(...).toBeInTheDocument();
}, { timeout: 5000 });
```

### Issue: Cloudflare deployment fails

**Solution**:
```bash
# Authenticate with Wrangler
npx wrangler login

# Check wrangler.toml configuration
# Ensure account_id is set
```

## Performance Optimization

### Frontend

```typescript
// Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Memoize expensive calculations
const expensiveValue = useMemo(() => calculateValue(data), [data]);

// Debounce user input
const debouncedSearch = useDebouncedValue(searchTerm, 300);
```

### Backend

```typescript
// Early return for invalid input
if (!host || !port) {
  return errorResponse('Invalid input');
}

// Timeout for slow connections
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 5000)
);

await Promise.race([socket.opened, timeout]);
```

## Security Best Practices

### Input Validation

```typescript
// Validate hostname
if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
  return errorResponse('Invalid hostname');
}

// Validate port range
if (port < 1 || port > 65535) {
  return errorResponse('Invalid port');
}
```

### CORS Configuration

```typescript
// Restrict origin in production
const corsHeaders = {
  'Access-Control-Allow-Origin':
    process.env.NODE_ENV === 'production'
      ? 'https://healthchecks.example.com'
      : '*',
};
```

### Rate Limiting (Recommended)

```typescript
// Implement rate limiting
// Use Cloudflare Workers KV or Durable Objects
```

## Environment Variables

### Local Development

```bash
# .dev.vars (gitignored)
API_KEY=your-dev-api-key
DEBUG=true
```

### Production

```bash
# Set via Wrangler
npx wrangler secret put API_KEY
# Enter value when prompted
```

### Access in Worker

```typescript
export default {
  async fetch(request, env, ctx) {
    const apiKey = env.API_KEY;
    // ...
  }
}
```

## Resources

### Official Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Sockets API](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW](https://mswjs.io/)

### Community

- [Cloudflare Workers Discord](https://discord.gg/cloudflaredev)
- [React Discord](https://discord.gg/react)
- [Vite Discord](https://chat.vitejs.dev/)

### Learning Resources

- [Kent C. Dodds - Testing React](https://kentcdodds.com/blog/testing-react-apps)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Web Accessibility](https://www.w3.org/WAI/fundamentals/)

---

**Development Guide Version**: 1.0
**Last Updated**: February 7, 2026
