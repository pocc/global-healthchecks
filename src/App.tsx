import { useState } from 'react';
import {
  Globe,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Play,
  Server,
} from 'lucide-react';

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  region?: string;
}

interface TestResult {
  region: string;
  regionName: string;
  status: 'pending' | 'connected' | 'failed' | 'timeout';
  latencyMs?: number;
  timestamp?: number;
  error?: string;
  colo?: string;
}

const REGIONS = [
  { code: 'enam', name: 'US-East', flag: '🇺🇸' },
  { code: 'wnam', name: 'US-West', flag: '🇺🇸' },
  { code: 'weur', name: 'EU-Central', flag: '🇪🇺' },
  { code: 'eeur', name: 'EU-East', flag: '🇪🇺' },
  { code: 'apac', name: 'Asia-East', flag: '🇯🇵' },
  { code: 'oc', name: 'Oceania', flag: '🇦🇺' },
];

const COMMON_PORTS = [
  { name: 'HTTP', port: 80 },
  { name: 'HTTPS', port: 443 },
  { name: 'SSH', port: 22 },
  { name: 'DNS', port: 53 },
  { name: 'MySQL', port: 3306 },
  { name: 'PostgreSQL', port: 5432 },
];

function App() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('443');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const toggleRegion = (code: string) => {
    setSelectedRegions((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code]
    );
  };

  const selectAllRegions = () => {
    setSelectedRegions(REGIONS.map((r) => r.code));
  };

  const clearRegions = () => {
    setSelectedRegions([]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runTest = async () => {
    if (!host || !port || selectedRegions.length === 0) {
      return;
    }

    setIsRunning(true);

    // Initialize results with pending status
    const initialResults: TestResult[] = selectedRegions.map((regionCode) => ({
      region: regionCode,
      regionName: REGIONS.find((r) => r.code === regionCode)?.name || regionCode,
      status: 'pending' as const,
    }));

    setResults(initialResults);

    // Run tests in parallel for all selected regions
    const testPromises = selectedRegions.map(async (regionCode, index) => {
      const regionName = REGIONS.find((r) => r.code === regionCode)?.name || regionCode;

      try {
        const checkRequest: HealthCheckRequest = {
          host: host.trim(),
          port: parseInt(port),
          timeout: 10000,
          region: regionCode,
        };

        const response = await fetch('/api/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(checkRequest),
        });

        const data = await response.json();

        // Update this specific region's result
        setResults((prev) =>
          prev.map((result, i) =>
            i === index
              ? {
                  region: regionCode,
                  regionName,
                  status: data.success ? 'connected' : 'failed',
                  latencyMs: data.latencyMs,
                  timestamp: data.timestamp || Date.now(),
                  error: data.error,
                  colo: data.colo,
                }
              : result
          )
        );
      } catch (error) {
        // Update with error
        setResults((prev) =>
          prev.map((result, i) =>
            i === index
              ? {
                  region: regionCode,
                  regionName,
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Request failed',
                  timestamp: Date.now(),
                }
              : result
          )
        );
      }
    });

    await Promise.all(testPromises);
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'timeout':
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-semibold';
    switch (status) {
      case 'pending':
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>Pending</span>;
      case 'connected':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Connected</span>;
      case 'failed':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Failed</span>;
      case 'timeout':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Timeout</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Globe className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Network Connection Tester</h1>
              <p className="text-slate-400 text-sm">
                Test connectivity across global regions in real-time
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Target Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Host Input */}
            <div>
              <label htmlFor="host" className="block text-sm font-medium text-slate-300 mb-2">
                Target IP / Hostname
              </label>
              <input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="example.com or 192.168.1.1"
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Port Input */}
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-slate-300 mb-2">
                Port Number
              </label>
              <input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                min="1"
                max="65535"
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Common Ports */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Quick Select Ports
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_PORTS.map((p) => (
                <button
                  key={p.port}
                  type="button"
                  onClick={() => setPort(p.port.toString())}
                  className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  {p.name} ({p.port})
                </button>
              ))}
            </div>
          </div>

          {/* Region Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-slate-300">
                Select Regions ({selectedRegions.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllRegions}
                  className="text-xs text-primary hover:text-primary-dark transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={clearRegions}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {REGIONS.map((region) => (
                <button
                  key={region.code}
                  type="button"
                  onClick={() => toggleRegion(region.code)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRegions.includes(region.code)
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-slate-600 bg-slate-700/30 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="text-2xl mb-1">{region.flag}</div>
                  <div className="text-sm font-medium">{region.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={runTest}
            disabled={isRunning || !host || !port || selectedRegions.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Connection Tests
              </>
            )}
          </button>

          {results.length > 0 && (
            <button
              onClick={clearResults}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Clear Results
            </button>
          )}
        </div>

        {/* Results Dashboard */}
        {results.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" />
                Connection Test Results
              </h2>
              <div className="text-sm text-slate-400">
                Target: {host}:{port}
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Region
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Latency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Data Center
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <span className="text-sm font-medium text-white">
                            {result.regionName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(result.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-300">
                          {result.latencyMs !== undefined
                            ? `${result.latencyMs}ms`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-300">
                          {result.colo || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-400">
                          {result.timestamp
                            ? new Date(result.timestamp).toLocaleTimeString()
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {result.error && (
                          <span className="text-xs text-red-400">{result.error}</span>
                        )}
                        {result.status === 'connected' && !result.error && (
                          <span className="text-xs text-green-400">Connected successfully</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="p-4 bg-slate-900/30 border-t border-slate-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Total Tests</div>
                  <div className="text-2xl font-bold text-white">{results.length}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Connected</div>
                  <div className="text-2xl font-bold text-green-500">
                    {results.filter((r) => r.status === 'connected').length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Failed</div>
                  <div className="text-2xl font-bold text-red-500">
                    {results.filter((r) => r.status === 'failed' || r.status === 'timeout')
                      .length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Avg Latency</div>
                  <div className="text-2xl font-bold text-primary">
                    {results.filter((r) => r.latencyMs).length > 0
                      ? Math.round(
                          results
                            .filter((r) => r.latencyMs)
                            .reduce((sum, r) => sum + (r.latencyMs || 0), 0) /
                            results.filter((r) => r.latencyMs).length
                        )
                      : '-'}
                    {results.filter((r) => r.latencyMs).length > 0 && 'ms'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && (
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 p-12 text-center">
            <WifiOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Test Results Yet</h3>
            <p className="text-slate-500">
              Configure your target and select regions to start testing connectivity
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-slate-500">
            Powered by Cloudflare Workers Sockets API •{' '}
            <a
              href="https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-dark transition-colors"
            >
              Documentation
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
