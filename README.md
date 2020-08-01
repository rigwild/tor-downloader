# tor-downloader
[![Node.js CI](https://github.com/rigwild/tor-downloader/workflows/Node.js%20CI/badge.svg)](https://github.com/rigwild/tor-downloader/actions) [![npm package](https://img.shields.io/npm/v/tor-downloader.svg?logo=npm)](https://www.npmjs.com/package/tor-downloader) ![npm downloads](https://img.shields.io/npm/dw/tor-downloader) ![license](https://img.shields.io/npm/l/tor-downloader?color=blue)

> 📥 Easily download the Tor expert bundle (tor.exe) with GPG signature check

This package lets you easily download the [Tor expert bundle](https://www.torproject.org/download/tor/) (the portable and headless `tor.exe` binary).

The GPG signature (sig file, `.asc`) file that comes with the download will be checked using the [Tor Browser Developers signing key](./torBrowserGpgPublicKey.ts) (`EF6E 286D DA85 EA2A 4BA7 DE68 4E2C 6E87 9329 8290`). See [How can I verify Tor Browser's signature?](https://support.torproject.org/tbb/how-to-verify-signature/).

Before starting the download, it will look for Tor in your specified download directory. If it is there, the Tor expert bundle archive GPG file signature will be checked, if valid, the download will be skipped. If the signature is invalid, the files will be deleted and a new clean download will start.


## Why

I used to drop a Powershell command to download the portable Tor binary so I wanted a better alternative.\
Plus, with this module I can check the GPG key with [OpenPGP.js](https://github.com/openpgpjs/openpgpjs), without requiring GPG to be installed on the target system.


## Install

```
$ yarn add tor-downloader
```


## Usage

```ts
import { downloadTor } from 'tor-downloader'

const torPaths = await downloadTor({
  // Default tor-downloader options, all optional
  torBrowserversion: '9.5.3',
  architecture: 'win32',
  torVersion: '0.4.3.6',
  outputPath: './'
})

/* => Tor was downloaded and its GPG signature was checked!
torPaths = {
  downloadURI: string      // Tor expert bundle download URI
  zipPath: string          // Tor expert bundle zip file path
  sigPath: string          // Tor expert bundle zip file `.asc` signature path
  extractedDirPath: string // Path where the Tor expert bundle was extracted to
  binaryPath: string       // `tor.exe` binary path
  neededDownload: boolean  // Was a download required ?
}
*/
```


## Complete usage example

 1. Download Tor
 2. Run Tor without logs (`--quiet`) using [execa](https://github.com/sindresorhus/execa)
 3. Get the running Tor instance route public IP with [node-fetch](https://github.com/node-fetch/node-fetch) using the Tor's SOCKS5 proxy server thanks to [simple-proxy-agent](https://github.com/zjael/simple-proxy-agent)
 4. Kill Tor

```ts
import { downloadTor } from 'tor-downloader'
import fetch from 'node-fetch'
import execa from 'execa'
const ProxyAgent = require('simple-proxy-agent')

const setup = async () => {
  // Download Tor and check its GPG file signature
  const { binaryPath: tor } = await downloadTor()

  // Run Tor and wait 10 seconds to let it connect to the Tor network
  const torRunningInstance = execa(tor, ['--quiet'])
  await new Promise(res => setTimeout(res, 10000))

  // Get public IP with Tor SOCKS5
  const torIP = await fetch('https://api.ipify.org/', {
    agent: new ProxyAgent('socks5://127.0.0.1:9050')
  }).then(res => res.text())
  console.log(`Tor IP: ${torIP}`)

  // Kill Tor
  torRunningInstance.cancel()

  // Get my public IP
  const myIP = await fetch('https://api.ipify.org/').then(res => res.text())
  console.log(`My public IP: ${myIP}`)
}

setup()

// =>
// Tor IP: 46.19.141.84
// My public IP: xxx.xxx.xxx.xxx
```


## License

[The MIT license](./LICENSE)
