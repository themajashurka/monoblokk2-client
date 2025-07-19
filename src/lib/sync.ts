import Throttle from 'throttle'
import Client from 'ssh2-sftp-client'
import fs from 'fs/promises'
import fsSync from 'fs'
import nodePath from 'path'

type ThrottleArgs =
  | { duration: number; completionTarget?: number }
  | { completeInSeconds: number }

export class Sync {
  static upload = async (args: {
    path: string
    remotePath: string
    move: boolean
    throttle?: ThrottleArgs
    login: {
      host: string
      username: string
      password: string
    }
  }): Promise<{ ok: boolean }> => {
    const config = {
      host: args.login.host,
      username: args.login.username,
      password: args.login.password,
      timeout: 30 * 1000,
      throttle: {
        bps: args.throttle
          ? (await Sync.calculateThrottleBandwidth({
              path: args.path,
              ...args.throttle,
            })) * 1000
          : undefined,
      } as Throttle.Options,
    }

    console.log('UPLOAD', args.path)

    const client = new Client()

    let input: Throttle | Buffer
    if (args.throttle) {
      input = new Throttle(config.throttle)
      const readStream = fsSync.createReadStream(args.path)
      readStream.pipe(input)
    } else {
      try {
        input = await fs.readFile(args.path)
      } catch (error) {
        console.error('file to be uploaded is not found!')
        return { ok: false }
      }
    }

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
        console.log('upload completed ->', nodePath.basename(args.path))
        return { ok: true }
      })
      .catch((err) => {
        console.error('upload errored ->', err.message)
        return { ok: false }
      })
  }

  static calculateThrottleBandwidth = async (
    args: ThrottleArgs & { path: string }
  ) => {
    const sizeInKb = (await fs.stat(args.path)).size / 1000
    const throttleKbps =
      sizeInKb *
      ('duration' in args
        ? 1 / (args.completionTarget ?? 1) / args.duration
        : 1 / args.completeInSeconds)
    console.log(
      //prettier-ignore
      'duration' in args ?  `size is -> ${sizeInKb.toFixed(1)}kb, duration is -> ${args.duration.toFixed(1)}s, throttle at -> ${throttleKbps.toFixed(1)}kb/s`
       : `size is -> ${sizeInKb.toFixed(1)}kb, complete in -> ${args.completeInSeconds.toFixed(1)}s, throttle at -> ${throttleKbps.toFixed(1)}kb/s`
    )
    return throttleKbps
  }
}
