# Methodology

## How each timing is taken

All checks use the Workers [TCP Sockets API](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/) (`connect()` from `cloudflare:sockets`). Times come from `Date.now()` inside the Worker. In Workers, the clock only advances at I/O events, which is exactly what these timings bracket.

### TCP

One plain socket. `tcpMs` = time from `connect()` until the socket reports the connection open. That includes:

- **DNS lookup** when `host` is a name. Measured: an unresolvable name fails after 15–33 ms; a hostname can add up to ~25 ms over its IP.
- **Cloudflare's outbound connection path.** Connection errors surface as `proxy request failed …`.

The socket is closed immediately; no data is sent.

### TLS

Two sockets are opened back to back to the same `host:port`:

1. plain TCP (`secureTransport: 'off'`): opens at `tcpMs`
2. TLS (`secureTransport: 'on'`): opens only after a completed, validated TLS handshake

`tlsHandshakeMs = TLS socket open − tcpMs`, floored at 0. This assumes both sockets' TCP connects take the same time; any difference between them lands in `tlsHandshakeMs`.

**The target sees two connections per check.** Expect that in firewall logs, connection-rate limits and SYN counters.

### HTTP

Same two-socket TLS step, then an HTTP/1.1 request is written on the TLS socket:

```
<METHOD> <path> HTTP/1.1
Host: <tlsServername or host>
<your headers>
Connection: close
```

`httpMs` = time from writing the request to receiving the first chunk of the response (TTFB). Only that first chunk is read; the status line is parsed from its first 2,048 characters. `success` is `true` for any status below 500.

With `followRedirects`, the `Location` header is resolved and a fresh check is run against it (same rules, including the private-address block and loop detection). Reported timings are for the final hop.

### Timeouts and retries

- `timeout` (default 5 s) applies to each phase separately: TCP open, TLS open, first response chunk.
- `retries` and `retryBackoff` apply to TCP-only checks.

## What the numbers include

- **Included:** DNS lookup (hostnames), Cloudflare's outbound connection path, network RTT from the Worker's data center to the target, the target's accept/handshake processing, and for `httpMs`, server think time.
- **Not the same as your RTT:** the path is Cloudflare data center → target, not you → target. `clientTcpRtt` gives you → Cloudflare edge for comparison (HTTP/1 and HTTP/2 clients only).
- **Pass an IP to exclude DNS.** The web UI sends the hostname, except for targets on Cloudflare's network, where it asks you for an origin IP instead.

## Where checks run

Each location is a separate Worker deployment of the same code, reachable at `<env>.healthchecks.ross.gg`.

| Group | Count | How location is pinned | Hostname examples |
|---|---|---|---|
| Regional Services | 10 | Cloudflare [Regional Services](https://developers.cloudflare.com/data-localization/regional-services/), assigned per hostname | `us`, `ca`, `eu`, `isoeu`, `de`, `jp`, `sg`, `kr`, `in`, `au` |
| AWS | 34 | [Placement](https://developers.cloudflare.com/workers/configuration/placement/) region `aws:<region>` | `aws-us-east-1`, `aws-eu-west-2` |
| GCP | 43 | Placement region `gcp:<region>` | `gcp-us-central1`, `gcp-asia-east1` |
| Azure | 56 | Placement region `azure:<region>` | `azure-eastus`, `azure-uksouth` |

The main site (`healthchecks.ross.gg`) runs at whichever data center your request reaches first.

### Verifying where a check ran

- **AWS, GCP, Azure locations:** read the `cf-placement` response header.
  - `remote-IAD`: the Worker ran in IAD.
  - `local-SJC`: placement wasn't applied and it ran where your request arrived.
  - The response body's `colo` is where your request *entered* Cloudflare, not where the Worker ran. For example, from Austin, `aws-us-east-1` returns `colo: AUS` with `cf-placement: remote-IAD`.
- **Regional Services locations and the main site:** there is no `cf-placement` header. `colo` is where the Worker ran: for example, `de` returns `FRA` and `jp` returns `KIX`.

Codes are listed in [COLO_CITIES.md](COLO_CITIES.md).

Placement runs the Worker in the Cloudflare data center with the lowest latency to the named cloud region. It is **not** inside the cloud provider's network, so expect a short extra hop compared with a VM in that region.
