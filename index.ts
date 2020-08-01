import path from 'path'
import util from 'util'
import fs from 'fs'
import { pipeline } from 'stream'
const streamPipeline = util.promisify(pipeline)

import fetch from 'node-fetch'
import * as openpgp from 'openpgp'
import extract from 'extract-zip'

import { torBrowserGpgPublicKey } from './torBrowserGpgPublicKey'

export interface TorVersion {
  torBrowserversion: '9.5.1' | '9.5.2' | '9.5.3' | '10.0a4'
  architecture: 'win32' | 'win64' /* | 'osx64' | 'linux32' | 'linux64'*/
  torVersion: string
}
export interface TorDownloaderOptions extends Partial<TorVersion> {
  /** Where to output Tor files */
  outputPath?: string
}

export interface TorDownloaderReturnType {
  /** Tor expert bundle download URI */
  downloadURI: string
  /** Tor expert bundle zip file path */
  zipPath: string
  /** Tor expert bundle zip file `.asc` signature path */
  sigPath: string
  /** Path where the Tor expert bundle was extracted to */
  extractedDirPath: string
  /** `tor.exe` binary path */
  binaryPath: string
  /** Was a download required ? */
  neededDownload: boolean
}

export const checkFileSignature = async (filePath: string, signaturePath: string) => {
  const verified = await openpgp.verify({
    message: openpgp.message.fromBinary(await fs.promises.readFile(filePath)),
    signature: await openpgp.signature.readArmored(await fs.promises.readFile(signaturePath, { encoding: 'utf-8' })),
    publicKeys: (await openpgp.key.readArmored(torBrowserGpgPublicKey)).keys
  })
  return verified.signatures[0].valid
}

export const getDownloadFileName = ({ architecture, torVersion }: Omit<TorVersion, 'torBrowserversion'>) =>
  `tor-${architecture}-${torVersion}.zip`
export const getDownloadURI = ({ torBrowserversion, architecture, torVersion }: TorVersion) =>
  `https://dist.torproject.org/torbrowser/${torBrowserversion}/${getDownloadFileName({ architecture, torVersion })}`

export const downloadFile = (uri: string, outputPath: string) =>
  fetch(uri).then(async x => {
    if (!x.ok) throw new Error(`Downloading ${uri} failed - HTTP ${x.status} - ${await x.text()}`)
    return streamPipeline(x.body, fs.createWriteStream(path.resolve(outputPath)))
  })

export const downloadTor = async ({
  torBrowserversion = '9.5.3',
  architecture = 'win32',
  torVersion = '0.4.3.6',
  outputPath = './'
}: TorDownloaderOptions = {}) => {
  const downloadURI = getDownloadURI({ torBrowserversion, architecture, torVersion })
  const zipPath = path.resolve(outputPath, getDownloadFileName({ architecture, torVersion }))
  const sigPath = zipPath + '.asc'
  const extractedDirPath = zipPath.replace(/\.zip$/, '')
  const binaryPath = path.resolve(extractedDirPath, 'Tor', 'tor.exe')

  const returnData: TorDownloaderReturnType = {
    downloadURI,
    zipPath,
    sigPath,
    extractedDirPath,
    binaryPath,
    neededDownload: true
  }

  // Check if Tor is already there
  if (fs.existsSync(zipPath) && fs.existsSync(sigPath)) {
    // Check Tor zip gpg signature
    if (await checkFileSignature(zipPath, sigPath)) {
      // Check Tor extracted directory and the Tor executable are already there
      if (fs.existsSync(extractedDirPath) && fs.existsSync(binaryPath)) return { ...returnData, neededDownload: false }

      // Extract already-downloaded Tor zip
      await extract(zipPath, { dir: extractedDirPath })
      return { ...returnData, neededDownload: false }
    } else {
      // Signature is wrong, remove all files and continue the download process
      await Promise.all([zipPath, sigPath, extractedDirPath].map(x => fs.promises.unlink(x).catch(() => {})))
    }
  }

  // mkdir -p to the output directory
  await fs.promises.mkdir(outputPath, { recursive: true })

  // Download Tor zip with its signature file
  await Promise.all([downloadFile(downloadURI, zipPath), downloadFile(downloadURI + '.asc', sigPath)])

  // Check Tor zip file signature
  if (!(await checkFileSignature(zipPath, sigPath))) throw new Error('Tor signature is invalid.')

  // Extract Tor zip
  try {
    await extract(zipPath, { dir: extractedDirPath })
  } catch (error) {
    throw new Error(`Tor zip extraction failed - ${error.message}`)
  }

  return returnData
}
