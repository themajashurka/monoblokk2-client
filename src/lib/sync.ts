import Throttle from 'throttle'
import Client from 'ssh2-sftp-client'
import fs from 'fs/promises'
import fsSync from 'fs'
import nodePath from 'path'

export class Sync {
  static upload = async (args: {
    path: string
    cleanPath: string
    remotePath: string
    move: boolean
    throttleKbps?: number
  }) => {
    const config = {
      host: process.env.SFTP_HOST,
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PWD,
      timeout: 30 * 1000,
      throttle: {
        bps: args.throttleKbps ? (args.throttleKbps / 8) * 1000 : undefined,
      } as Throttle.Options,
    }

    let client = new Client()

    if (args.throttleKbps) {
      var throttleStream = new Throttle(config.throttle)
      const readStream = fsSync.createReadStream(args.path)
      readStream.pipe(throttleStream)
    } else {
      var file = await fs.readFile(args.path)
    }

    return client
      .connect(config)
      .then(() => {
        return client.mkdir(nodePath.dirname(args.remotePath), true)
      })
      .then(() => {
        return client.put(throttleStream ?? file, args.remotePath)
      })
      .then(() => {
        return client.end()
      })
      .then(args.move ? () => fs.unlink(args.path) : () => {})
      .then(() => {
        console.log('upload completed ->', nodePath.basename(args.cleanPath))
      })
      .catch((err) => {
        console.error('upload completed ->', err.message)
        return fs.rename(args.path, args.cleanPath)
      })
  }
}