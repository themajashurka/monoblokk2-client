import { spawn, exec } from 'child_process'
import path from 'path'
import { TrayMenu } from './trayMenu'
const _fkill = import('fkill').then((x) => x.default)
import fs from 'fs/promises'
import { app } from 'electron'
import { EOL } from 'node:os'
import type { Express } from 'express'
import { Client } from 'basic-ftp'

export type CCTVObj = CCTV['cameraLogins'][number]

export class CCTV {
  private trayMenu: TrayMenu
  cameraLogins: {
    username: string
    password: string
    ip: string
  }[] = []
  remote: {
    username: string
    password: string
    ip: string
  }[] = []
  port: number = 8891

  static processingSuffix = '_processing'
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
                `    runOnRecordSegmentComplete: curl -s http://localhost:3000/compressNewRecordings?camera=$MTX_PATH&path=$MTX_SEGMENT_PATH`,
              ]
            })
            .flat()
          break
        case '#webrtcAddress:':
          value = [`webrtcAddress: :${this.port}`]
          break
        case '  #recordPath:':
          value = [
            `  recordPath: ${app.getPath(
              'userData'
            )}/recordings/%path/%Y-%m-%d_%H-%M-%S-%f`,
          ]
          break
      }

      configArr.splice(insertionIndex + 1, 0, value.join('\n'))
    }
    await fs.writeFile(configPath, configArr.join('\n'))

    //rclone confing
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

      const command =
        // prettier-ignore
        `${trayMenu.cctv.ffmpegBinaryPath} -hide_banner -loglevel error -i ${inPath} -vf "scale=1920:-2, fps=10" -b:v 400k -threads 1 -preset veryfast ${outPath}`
      //console.log('commmmmmmmmmmmmmmmmmmmmand', command, cleanPath)
      exec(command, async (error, stdout, stderr) => {
        if (error) console.error(error)
        if (stderr) console.error(stderr)
        await fs.rename(outPath, cleanPath)
        console.log('compressing done! ->', path.basename(_path))
        await CCTV.upload(camera, cleanPath, trayMenu)
        await fs.unlink(cleanPath)
      })
    })
  }

  static upload = async (camera: string, _path: string, trayMenu: TrayMenu) => {
    const client = new Client()
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PWD,
        secure: true,
        secureOptions: { rejectUnauthorized: !trayMenu.dev },
      })
      await client.ensureDir(`/files/${camera}`)
      await client.uploadFrom(_path, `/files/${camera}/${path.basename(_path)}`)
      console.log('uploading done! ->', path.basename(_path, CCTV.outExt))
    } catch (err) {
      console.log(err)
    }
    client.close()
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
