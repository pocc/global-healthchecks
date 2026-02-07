import { useState } from 'react';
import './App.css';

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  region?: string;
}

interface HealthCheckResult {
  success: boolean;
  host: string;
  port: number;
  region?: string;
  latencyMs?: number;
  error?: string;
  timestamp: number;
  cfRay?: string;
  colo?: string;
}

const COMMON_PORTS = [
  { name: 'HTTP', port: 80 },
  { name: 'HTTPS', port: 443 },
  { name: 'SSH', port: 22 },
  { name: 'FTP', port: 21 },
  { name: 'SMTP', port: 25 },
  { name: 'DNS', port: 53 },
  { name: 'MySQL', port: 3306 },
  { name: 'PostgreSQL', port: 5432 },
  { name: 'Redis', port: 6379 },
  { name: 'MongoDB', port: 27017 },
];

const REGIONS = [
  { code: 'enam', name: 'Eastern North America' },
  { code: 'wnam', name: 'Western North America' },
  { code: 'weur', name: 'Western Europe' },
  { code: 'eeur', name: 'Eastern Europe' },
  { code: 'apac', name: 'Asia Pacific' },
  { code: 'oc', name: 'Oceania' },
];

function App() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('443');
  const [timeout, setTimeout] = useState('5000');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthCheckResult | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const checkRequest: HealthCheckRequest = {
        host: host.trim(),
        port: parseInt(port),
        timeout: parseInt(timeout),
      };

      if (region) {
        checkRequest.region = region;
      }

      const response = await fetch('/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkRequest),
      });

      const data = (await response.json()) as HealthCheckResult;
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        host,
        port: parseInt(port),
        error: error instanceof Error ? error.message : 'Request failed',
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const setCommonPort = (portNum: number) => {
    setPort(portNum.toString());
  };

  return (
    <div className="container">
      <header>
        <h1>🌍 Global Health Checks</h1>
        <p>Test TCP port connectivity using Cloudflare Workers Sockets API</p>
      </header>

      <main>
        <form onSubmit={handleCheck}>
          <div className="form-group">
            <label htmlFor="host">Hostname or IP Address</label>
            <input
              id="host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com or 1.1.1.1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="port">Port</label>
            <input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min="1"
              max="65535"
              required
            />
            <div className="common-ports">
              {COMMON_PORTS.map((p) => (
                <button
                  key={p.port}
                  type="button"
                  className="port-btn"
                  onClick={() => setCommonPort(p.port)}
                >
                  {p.name} ({p.port})
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="timeout">Timeout (ms)</label>
              <input
                id="timeout"
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(e.target.value)}
                min="1000"
                max="30000"
                step="1000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="region">Region Hint (Optional)</label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">Auto</option>
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="check-btn">
            {loading ? 'Checking...' : 'Run Health Check'}
          </button>
        </form>

        {result && (
          <div className={`result ${result.success ? 'success' : 'error'}`}>
            <h2>
              {result.success ? '✅ Connection Successful' : '❌ Connection Failed'}
            </h2>
            <dl>
              <dt>Host:</dt>
              <dd>{result.host}</dd>

              <dt>Port:</dt>
              <dd>{result.port}</dd>

              {result.latencyMs !== undefined && (
                <>
                  <dt>Latency:</dt>
                  <dd>{result.latencyMs}ms</dd>
                </>
              )}

              {result.region && (
                <>
                  <dt>Region:</dt>
                  <dd>{result.region}</dd>
                </>
              )}

              {result.colo && (
                <>
                  <dt>Cloudflare Colo:</dt>
                  <dd>{result.colo}</dd>
                </>
              )}

              {result.cfRay && (
                <>
                  <dt>CF-Ray:</dt>
                  <dd>{result.cfRay}</dd>
                </>
              )}

              {result.error && (
                <>
                  <dt>Error:</dt>
                  <dd className="error-msg">{result.error}</dd>
                </>
              )}

              <dt>Timestamp:</dt>
              <dd>{new Date(result.timestamp).toLocaleString()}</dd>
            </dl>
          </div>
        )}
      </main>

      <footer>
        <p>
          Powered by Cloudflare Workers Sockets API •{' '}
          <a
            href="https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
