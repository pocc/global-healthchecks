import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

// Simple component that uses the health check API
function HealthCheckForm() {
  const [result, setResult] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [host, setHost] = React.useState('example.com');
  const [port, setPort] = React.useState('443');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port: parseInt(port),
          timeout: 5000,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="Host"
          aria-label="Host"
        />
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="Port"
          aria-label="Port"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Checking...' : 'Check'}
        </button>
      </form>

      {result && (
        <div data-testid="result">
          {result.success ? (
            <div>
              <p>Success!</p>
              <p>Latency: {result.latencyMs}ms</p>
              <p>Colo: {result.colo}</p>
            </div>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Import React for the component
import React from 'react';

describe('Health Check API Integration', () => {
  it('should successfully fetch health check data', async () => {
    const user = userEvent.setup();

    render(<HealthCheckForm />);

    // Fill out form
    const hostInput = screen.getByLabelText(/host/i);
    const portInput = screen.getByLabelText(/port/i);
    const submitButton = screen.getByRole('button', { name: /check/i });

    await user.clear(hostInput);
    await user.type(hostInput, 'example.com');
    await user.clear(portInput);
    await user.type(portInput, '443');

    // Submit form
    await user.click(submitButton);

    // Wait for loading state
    expect(screen.getByRole('button', { name: /checking/i })).toBeInTheDocument();

    // Wait for result
    await waitFor(() => {
      expect(screen.getByTestId('result')).toBeInTheDocument();
    });

    // Verify success message
    expect(screen.getByText(/success!/i)).toBeInTheDocument();
    expect(screen.getByText(/latency: 45ms/i)).toBeInTheDocument();
    expect(screen.getByText(/colo: sfo/i)).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    // Override the default handler for this test
    server.use(
      http.post('/api/check', () => {
        return HttpResponse.json(
          {
            success: false,
            host: 'example.com',
            port: 443,
            error: 'Connection timeout',
            timestamp: Date.now(),
          },
          { status: 200 }
        );
      })
    );

    const user = userEvent.setup();
    render(<HealthCheckForm />);

    const submitButton = screen.getByRole('button', { name: /check/i });
    await user.click(submitButton);

    // Wait for error result
    await waitFor(() => {
      expect(screen.getByText(/error: connection timeout/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors', async () => {
    // Simulate network error
    server.use(
      http.post('/api/check', () => {
        return HttpResponse.error();
      })
    );

    const user = userEvent.setup();
    render(<HealthCheckForm />);

    const submitButton = screen.getByRole('button', { name: /check/i });
    await user.click(submitButton);

    // Wait for error result
    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });

  it('should disable submit button while loading', async () => {
    const user = userEvent.setup();
    render(<HealthCheckForm />);

    const submitButton = screen.getByRole('button', { name: /check/i });

    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    // Button should be disabled during request
    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId('result')).toBeInTheDocument();
    });

    // Button should be enabled again
    expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
  });
});

describe('Batch Health Check API', () => {
  it('should fetch batch health check results', async () => {
    const response = await fetch('/api/batch-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checks: [
          { host: 'example.com', port: 80 },
          { host: 'example.com', port: 443 },
        ],
      }),
    });

    const data = await response.json();

    expect(data.results).toHaveLength(2);
    expect(data.results[0]).toMatchObject({
      success: true,
      host: 'example.com',
      port: 80,
    });
    expect(data.results[1]).toMatchObject({
      success: true,
      host: 'example.com',
      port: 443,
    });
  });
});

describe('MSW Handler Testing', () => {
  it('should use MSW to mock API calls', async () => {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'test.example.com',
        port: 8080,
      }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data).toMatchObject({
      success: true,
      host: 'test.example.com',
      port: 8080,
      latencyMs: 45,
      cfRay: 'mock-ray-123',
      colo: 'SFO',
    });
  });

  it('should override handlers for specific tests', async () => {
    server.use(
      http.post('/api/check', async ({ request }) => {
        const body = await request.json() as any;

        return HttpResponse.json({
          success: false,
          host: body.host,
          port: body.port,
          error: 'Custom error for this test',
          timestamp: Date.now(),
        });
      })
    );

    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'fail.com', port: 80 }),
    });

    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe('Custom error for this test');
  });
});
