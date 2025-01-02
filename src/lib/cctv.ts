import { spawn, exec } from 'child_process'
import path from 'path'
import { TrayMenu } from './trayMenu'
const _fkill = import('fkill').then((x) => x.default)
import fs from 'fs/promises'
import fsSync from 'fs'
import { app } from 'electron'
import { EOL } from 'node:os'
import type { Express } from 'express'
import Client from 'ssh2-sftp-client'
import Throttle from 'throttle'
import { Sync } from './sync'

export type CCTVObj = CCTV['cameraLogins'][number]

export class CCTV {
  private trayMenu: TrayMenu
  cameraLogins: {
    username: string
    password: string
    ip: string
    segmentDurationInMinutes: number
    deleteAfterDays: number
    enableCompression: boolean
    compressedFps: number
    compressedKbps: number
    compressedWidth: number
    encodingPreset: string
  }[] = []
  remote: {
    username: string
    password: string
    ip: string
  }[] = []
  port: number = 8891

  static processingSuffix = '_processing'
  static uploadingSuffix = '_uploading'
  static inExt = '.ts'
  static outExt = '.mp4'

  private get mediamtxBinaryPath() {
    const mediamtxBinaryDir = this.trayMenu.dev
      ? 'mediamtx_binary'
      : path.join(process.resourcesPath, 'mediamtx_binary_win32') //TODO: remove _win32
    const mediamtxBinaryFile = `mediamtx_${process.platform}${
      process.platform === 'win32' ? '.exe' : ''
    }` //darwin, linux, win32
    return path.join(mediamtxBinaryDir, mediamtxBinaryFile)
  }

  private get ffmpegBinaryPath() {
    const mediamtxBinaryDir = this.trayMenu.dev
      ? 'ffmpeg_binary'
      : path.join(process.resourcesPath, 'ffmpeg_binary_win32') //TODO: remove _win32
    const mediamtxBinaryFile = `ffmpeg_${process.platform}${
      process.platform === 'win32' ? '.exe' : ''
    }` //darwin, linux, win32
    return path.join(mediamtxBinaryDir, mediamtxBinaryFile)
  }

  setCameraLogins = async (x: CCTVObj[]) => {
    this.cameraLogins = x
    await this.rewriteConfig()
  }

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  rewriteConfig = async () => {
    //mediamtx config
    const templateConfigPath = this.trayMenu.dev
      ? 'mediamtx_template.yml'
      : path.join(process.resourcesPath, 'mediamtx_template.yml')
    const configPath = 'mediamtx.yml'

    const config = await fs.readFile(templateConfigPath, { encoding: 'utf8' })

    let configArr: string[] = config.split(EOL)

    for (const line of [
      'paths:',
      '#webrtcAddress:',
      '  #recordPath:',
      '#recordSegmentDuration:',
    ] as const) {
      const insertionIndex = configArr.findIndex((x) => x === line)

      let value: string[] = ['']
      switch (line) {
        case 'paths:':
          value = this.cameraLogins
            .map((cl) => {
              return [
                `  ${cl.username}:`,
                `    source: rtsp://${cl.username}:${cl.password}@${cl.ip}:554/stream1`,
                //prettier-ignore
                `    runOnRecordSegmentComplete: http://localhost:3000/compressNewRecordings?camera=$MTX_PATH&path=$MTX_SEGMENT_PATH`,
                `    recordSegmentDuration: ${cl.segmentDurationInMinutes}m`,
                `    recordDeleteAfter: ${cl.deleteAfterDays * 24}h`,
              ]
            })
            .flat()
          break
        case '#webrtcAddress:':
          value = [`webrtcAddress: :${this.port}`]
          break
        case '  #recordPath:':
          value = [
            `  recordPath: ${app
              .getPath('userData')
              .replaceAll('\\', '/')}/recordings/%path/%Y-%m-%d_%H-%M-%S-%f`,
          ]
          break
      }

      configArr.splice(insertionIndex + 1, 0, value.join('\n'))
    }
    await fs.writeFile(configPath, configArr.join('\n'))
  }

  startService = async () => {
    await Promise.allSettled([
      new Promise(() => {
        const { stdout, stderr } = spawn(this.mediamtxBinaryPath, {
          stdio: 'pipe',
          detached: true,
        })
        stdout.setEncoding('utf8')
        stderr.setEncoding('utf8')
        stdout.on('data', (data) => console.log(data))
        stderr.on('data', (data) => console.log(data))
      }),
    ])
  }

  static compressNewRecordings = (express: Express, trayMenu: TrayMenu) => {
    express.get('/compressNewRecordings', async (req, res) => {
      const _path = path.join(
        path.dirname(req.query.path as string),
        path.basename(req.query.path as string, CCTV.inExt)
      )
      const camera = req.query.camera as string | null
      if (!_path || !camera) return

      try {
        await fs.mkdir(
          path.resolve(
            _path,
            '..',
            '..',
            '..',
            'recordings_compressed',
            camera
          ),
          { recursive: true }
        )
      } catch (error) {
        console.error(error)
      }

      const [inPath, outPath] = [
        `${_path}${CCTV.inExt}`,
        `${path.resolve(
          _path,
          '..',
          '..',
          '..',
          'recordings_compressed',
          camera,
          path.basename(_path)
        )}${CCTV.processingSuffix}${CCTV.outExt}`,
      ]
      const cleanPath =
        path.join(
          path.dirname(outPath),
          path.basename(outPath, `${CCTV.processingSuffix}${CCTV.outExt}`)
        ) + CCTV.outExt
      const uploadingPath =
        path.join(
          path.dirname(cleanPath),
          path.basename(cleanPath, CCTV.outExt)
        ) +
        CCTV.uploadingSuffix +
        CCTV.outExt

      const cameraObj = trayMenu.cctv.cameraLogins.find(
        (cl) => cl.username === camera
      )!

      const command = `${trayMenu.cctv.ffmpegBinaryPath} -hide_banner -loglevel error -i ${inPath} -vf "scale=${cameraObj.compressedWidth}:-2, fps=${cameraObj.compressedFps}" -b:v ${cameraObj.compressedKbps}k -threads 1 -preset ${cameraObj.encodingPreset} ${outPath}`
      console.log(command)
      if (cameraObj.enableCompression) {
        exec(command, async (error, stdout, stderr) => {
          if (error) console.error(error)
          if (stderr) console.error(stderr)
          await fs.rename(outPath, uploadingPath)
          console.log('compressing done! ->', path.basename(_path))
          res.json({ compressing: 'done' })
          await CCTV.move(camera, uploadingPath, cleanPath)
        })
      } else {
        console.log('compression is disabled')
        await fs.rename(outPath, uploadingPath)
        res.json({ compressing: 'disabled' })
      }
    })
  }

  static move = async (camera: string, _path: string, cleanPath: string) => {
    const sizeInKb = (await fs.stat(_path)).size * 1000
    await Sync.upload({
      move: true,
      cleanPath,
      path: _path,
      remotePath: `/home/marci/cctv/${camera}/${path.basename(cleanPath)}`,
      throttleKbps: sizeInKb * 2,
    })
  }

  killService = async () => {
    const fkill = await _fkill
    let pid: string
    switch (process.platform) {
      case 'linux':
        try {
          pid = await new Promise((res, rej) => {
            exec('pgrep mediamtx', (error, stdout, stderr) => {
              if (stdout) res(stdout)
              if (error) rej(error)
              if (stderr) rej(stderr)
            })
          })
          if (pid!) {
            await fkill(Number(pid))
            console.log('killed mediamtx on:', pid)
          }
        } catch (error) {
          console.error(error)
        }
        break
      case 'win32':
        try {
          await new Promise((res, rej) => {
            exec(
              'taskkill /f /t /im mediamtx_win32.exe',
              (error, stdout, stderr) => {
                if (stdout) res(stdout)
                if (error) rej(error)
                if (stderr) rej(stderr)
              }
            )
          })
        } catch (error) {}
        break

      default:
        break
    }
  }
}
