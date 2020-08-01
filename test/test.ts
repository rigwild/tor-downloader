import test, { ExecutionContext } from 'ava'

import fs from 'fs'
import path from 'path'

import execa from 'execa'
import fetch from 'node-fetch'
const ProxyAgent = require('simple-proxy-agent')

import { downloadTor, TorDownloaderReturnType } from '../index'

const outputPath = path.resolve(__dirname, 'tor-test')
const clearTorDir = () => fs.promises.rmdir(outputPath, { recursive: true }).catch(() => {})

test.before(clearTorDir)

const checkTorPaths = (t: ExecutionContext, torPaths: TorDownloaderReturnType) => {
  const paths = [outputPath, torPaths.zipPath, torPaths.sigPath, torPaths.extractedDirPath]
  paths.forEach(x => t.true(fs.existsSync(x)))
}

test.serial('Download tor', async t => {
  const torPaths = await downloadTor({ outputPath })

  t.true(torPaths.neededDownload)
  checkTorPaths(t, torPaths)
})

test.serial('Check already-downloaded tor is not downloaded again', async t => {
  const torPaths = await downloadTor({ outputPath })

  t.false(torPaths.neededDownload)
  checkTorPaths(t, torPaths)
})

test.serial('Check modified Tor zip is re-downloaded after a failed signature check', async t => {
  // Just to get the Tor zip path
  const _torPaths = await downloadTor({ outputPath })

  // Clear the Tor zip file to change its signature
  await fs.promises.writeFile(_torPaths.zipPath, 'hello', { encoding: 'utf8' })

  const torPaths = await downloadTor({ outputPath })

  // Deleted old Tor and downloaded a fresh one
  t.true(torPaths.neededDownload)
  checkTorPaths(t, torPaths)
})

test.serial('Try running Tor as a SOCKS5 proxy', async t => {
  // Just to get the Tor binary path
  const { binaryPath: tor } = await downloadTor({ outputPath })

  // Run Tor and wait 10 seconds to let it connect to the Tor network
  const torInstance = execa(tor, ['--quiet'], { timeout: 60_000 })
  await new Promise(res => setTimeout(res, 10000))

  const getPublicIp = async (useTor: boolean) =>
    fetch('https://api.ipify.org/', {
      agent: useTor ? new ProxyAgent('socks5://127.0.0.1:9050') : undefined
    }).then(res => res.text())

  // Get public IP with and without Tor SOCKS5 and check they are different
  const ip = await getPublicIp(false)
  const ipTor = await getPublicIp(true)

  torInstance.cancel()
  t.not(ip, ipTor)
})

test.after(clearTorDir)
