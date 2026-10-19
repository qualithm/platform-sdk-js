/**
 * List the workspace's devices.
 *
 *   QUALITHM_API_TOKEN=qmt_... bun run examples/list-devices.ts
 */
import { DevicesApi, PlatformClient, PlatformError } from "@qualithm/platform"

const platform = new PlatformClient()

try {
  const { data } = await platform.api(DevicesApi).listDevices({ limit: 20 })
  for (const device of data.items) {
    process.stdout.write(`${device.id}  ${device.spaceName}  ${device.name}\n`)
  }
} catch (error) {
  if (error instanceof PlatformError) {
    process.stderr.write(`list-devices: ${error.message} (${error.code})\n`)
    process.exit(1)
  }
  throw error
}
