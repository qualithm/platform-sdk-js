/**
 * List the devices in the token's team.
 *
 *   QUALITHM_API_TOKEN=qmt_... bun run example examples/list-devices.ts
 */
import { DevicesApi, PlatformClient, PlatformError, TeamsApi } from "@qualithm/platform"

const platform = new PlatformClient()

try {
  // An API token belongs to one team, so its team list has exactly that team.
  const teams = await platform.api(TeamsApi).listTeams()
  const team = teams.data.items.at(0)
  if (team === undefined) {
    process.stderr.write("list-devices: the token has no team\n")
    process.exit(1)
  }

  const { data } = await platform.api(DevicesApi).listDevices({ teamId: team.id, limit: 20 })
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
