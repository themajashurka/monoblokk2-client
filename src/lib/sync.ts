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
    login: {
      host: string
      username: string
      password: string
    }
  }) => {
    const config = {
      host: args.login.host,
      username: args.login.username,
      password: args.login.password,
      timeout: 30 * 1000,
      throttle: {
        bps: args.throttleKbps ? args.throttleKbps * 1000 : undefined,
      } as Throttle.Options,
    }

    const client = new Client()

    let input: Throttle | Buffer
    if (args.throttleKbps) {
      input = new Throttle(config.throttle)
      const readStream = fsSync.createReadStream(args.path)
      readStream.pipe(input)
    } else {
      input = await fs.readFile(args.path)
    }

    console.log(args.remotePath)

    return client
      .connect(config)
      .then(() => {
        return client.mkdir(nodePath.dirname(args.remotePath), true)
      })
      .then(() => {
        return client.put(input, args.remotePath)
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
