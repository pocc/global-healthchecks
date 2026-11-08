# Global Health Checks

Measure TCP, TLS and HTTP handshake latency to any public host from 143 Cloudflare Worker locations at once: 10 Regional Services regions plus 133 AWS, GCP and Azure regions via targeted placement.

**Live:** https://healthchecks.ross.gg

## What you get

For each location, per check:

| Field | Meaning |
|---|---|
| `tcpMs` | Time to open a TCP connection from the Worker, including DNS lookup if you pass a hostname |
| `tlsHandshakeMs` | TLS handshake time, estimated as (TLS socket open − TCP socket open) |
| `httpMs` | Time to first byte after the HTTP request is sent |
| `cf-placement` header | Data center a placed Worker actually ran in, e.g. `remote-IAD` |
| `colo` / `coloCity` | Data center your API request entered Cloudflare through |

See [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for exactly how each number is measured and [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for what can't be tested (UDP, ICMP, HTTP/2, targets on Cloudflare's network, and more).

## Quick API example

```bash
curl -s -X POST https://aws-us-east-1.healthchecks.ross.gg/api/check \
  -H 'Content-Type: application/json' \
  -d '{"host":"github.com","port":443,"httpEnabled":true}'
```

Every location has its own hostname (`<env>.healthchecks.ross.gg`, e.g. `eu`, `gcp-asia-east1`, `azure-uksouth`). Full reference: [docs/API.md](docs/API.md).

## Docs

| Doc | For |
|---|---|
| [docs/API.md](docs/API.md) | Endpoints, request fields, response fields |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | How timings are taken and where checks run |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | What the Workers runtime can't do |
| [docs/COLO_CITIES.md](docs/COLO_CITIES.md) | Cloudflare IATA colo codes → cities |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local dev, tests, deploying your own copy |

## Responsible use

Only test hosts you own or are permitted to test. Private, loopback, link-local and CGNAT addresses are rejected.

## License

[MIT](LICENSE)
