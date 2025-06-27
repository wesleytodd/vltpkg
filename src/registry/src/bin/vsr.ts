#!/usr/bin/env NODE_OPTIONS=--no-warnings node
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PathScurry } from 'path-scurry'
import { PackageJson } from '@vltpkg/package-json'
import { PackageInfoClient } from '@vltpkg/package-info'
import { createServer } from '@vltpkg/server'
import { existsSync } from 'node:fs'
import type { VltServerOptions } from '@vltpkg/server'
import { DAEMON_PORT, DAEMON_URL, URL } from '../../config.ts'
import { minargs } from 'minargs'

const usage = `USAGE: 

  $ vsr [<options>]
  
OPTIONS:      DESCRIPTION:

-d, --debug   Run in debug mode
-h, --help    Print usage information
`
const opts = {
  alias: {
    d: 'debug',
    h: 'help',
  },
}
const { args } = minargs(opts) as {
  args: { debug?: boolean; help?: boolean }
}

// Print usage information
function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(usage)
}

// Check if the help flag was passed
if (args.help) {
  printUsage()
  process.exit(0)
}

// TODO: Remove the demo/dummy project once server doesn't need one
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const demo = path.resolve(__dirname, './demo')

// Resolve paths relative to this script's location
const registryRoot = path.resolve(__dirname, '../../')
const indexPath = path.resolve(registryRoot, 'dist/index.js')

// Find the wrangler binary from node_modules
const wranglerBinPath = path.resolve(
  registryRoot,
  'node_modules/.bin/wrangler',
)
const wranglerBin =
  existsSync(wranglerBinPath) ? wranglerBinPath : 'wrangler'

const serverOptions = {
  scurry: new PathScurry(demo),
  projectRoot: demo,
  packageJson: new PackageJson(),
  catalog: {},
  catalogs: {},
  registry: 'https://registry.npmjs.org/',
  registries: {},
  'scope-registries': {},
  'git-hosts': {},
  'git-host-archives': {},
} as VltServerOptions

void (async () => {
  try {
    const server = createServer({
      ...serverOptions,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      packageInfo: new PackageInfoClient() as any,
    })

    await server.start({
      port: DAEMON_PORT,
    })

    // eslint-disable-next-line no-console
    console.log(`Daemon: ${DAEMON_URL}`)
    // eslint-disable-next-line no-console
    console.log(`VSR: ${URL}`)

    // spawn the wrangler dev process with resolved paths
    const { stdout, stderr } = spawn(
      wranglerBin,
      [
        'dev',
        indexPath,
        '--local',
        '--persist-to=local-store',
        '--no-remote',
      ],
      {
        cwd: registryRoot, // Set working directory to registry root
      },
    )

    if (args.debug) {
      stdout.on('data', (data: Buffer) => {
        // eslint-disable-next-line no-console
        console.log(data.toString())
      })
      stderr.on('data', (data: Buffer) => {
        // eslint-disable-next-line no-console
        console.error(data.toString())
      })
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error)
    process.exit(1)
  }
})()
