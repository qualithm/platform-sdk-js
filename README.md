# Platform SDK

[![CI](https://github.com/qualithm/platform-sdk-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/qualithm/platform-sdk-js/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/qualithm/platform-sdk-js/graph/badge.svg)](https://codecov.io/gh/qualithm/platform-sdk-js)
[![npm](https://img.shields.io/npm/v/@qualithm/platform)](https://www.npmjs.com/package/@qualithm/platform)

TypeScript client for the Qualithm Platform API, generated from its OpenAPI spec. Every operation
and type comes from the spec the API serves, so the client changes when the API does.

## Features

- **Every management operation** — one typed method per operation, grouped by resource
  (`DevicesApi`, `AutomationsApi`, …), with the spec's names
- **One error type** — every failure is a `PlatformError` carrying the API's stable `code`
- **Configured from the environment** — `QUALITHM_API_TOKEN` and `QUALITHM_API_URL`
- **No dependencies** — runs on the global `fetch` in Bun, Node.js 20+ and Deno

## Installation

```bash
bun add @qualithm/platform
# or
npm install @qualithm/platform
```

## Quick Start

Create an API token in the Qualithm app, on the team page under **API tokens**, then:

```ts
import { DevicesApi, PlatformClient, TeamsApi } from "@qualithm/platform"

const platform = new PlatformClient({ token: "<your-api-token>" })

// An API token belongs to one team, so its team list has exactly that team.
const teams = await platform.api(TeamsApi).listTeams()
const teamId = teams.data.items[0].id

const { data } = await platform.api(DevicesApi).listDevices({ teamId })

for (const device of data.items) {
  console.log(device.name)
}
```

## Usage

### Configure the client

`PlatformClient` reads `QUALITHM_API_TOKEN` and `QUALITHM_API_URL` when you don't pass `token` or
`baseUrl`. The base URL defaults to the production API, `https://api.qualithm.com`.

```ts
const platform = new PlatformClient({
  token: process.env.QUALITHM_API_TOKEN,
  baseUrl: "https://api.qualithm.com"
})
```

### Call an operation

`platform.api(SomeApi)` returns that resource group, bound to your token. Method names match the
spec's `operationId`s. Every response is the API's envelope, so the result is in `data`. Operations
on a team's resources take its `teamId`:

```ts
import { AutomationsApi } from "@qualithm/platform"

const { data } = await platform.api(AutomationsApi).listAutomations({ teamId, page: 1, limit: 50 })
```

### Error Handling

Every failure is a `PlatformError`. Branch on `code`, never on `message`. A code this version
doesn't know yet reads as `unknown`, and a request that got no response has `status` `0`:

```ts
import { DevicesApi, PlatformError } from "@qualithm/platform"

try {
  await platform.api(DevicesApi).getDevice({ teamId, deviceId: "<device-id>" })
} catch (error) {
  if (error instanceof PlatformError && error.code === "not_found") {
    // the device doesn't exist, or isn't in this team
  }
  throw error
}
```

## API Reference

The operations and types are generated from the platform's OpenAPI spec, committed as
[`openapi.json`](openapi.json). Build the API documentation with [TypeDoc](https://typedoc.org/):

```bash
bun run docs
```

## Examples

| Example                                       | Description                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| [`list-devices.ts`](examples/list-devices.ts) | List the workspace's devices, and report a `PlatformError` |

```bash
QUALITHM_API_TOKEN=<your-api-token> bun run examples/list-devices.ts
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/), to regenerate the client

### Setup

```bash
bun install
```

### Regenerating

`src/generated/` comes from `openapi.json` and the generator pinned in `scripts/generate`. Never
edit it by hand: CI regenerates it and fails on any difference. The platform opens a pull request
here with the new spec and the regenerated code whenever its API changes. To regenerate by hand:

```bash
bun run generate
```

The hand-written layer is `src/client.ts` and `src/error.ts`.

### Checks

```bash
bun run lint
bun run format
bun run typecheck
bun run test
bun run build
```

## License

Apache-2.0
