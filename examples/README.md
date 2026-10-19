# Examples

Each example reads the API token from `QUALITHM_API_TOKEN`. Create one in the Qualithm app, on the
team page under **API tokens**.

| Example                              | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| [`list-devices.ts`](list-devices.ts) | List the workspace's devices, and report a `PlatformError` |

```bash
QUALITHM_API_TOKEN=<your-api-token> bun run examples/list-devices.ts
```
