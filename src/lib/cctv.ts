import { spawn, exec } from 'child_process'
import path from 'path'
import { TrayMenu } from './trayMenu'
const _fkill = import('fkill').then((x) => x.default)
import fs from 'fs/promises'
import { app } from 'electron'
import { EOL } from 'node:os'
import type { Express } from 'express'
import { Sync } from './sync'
import sqlite3 from 'sqlite3'
import { Database, open } from 'sqlite'

export type CCTVObj = CCTV['cameraLogins'][number]
enum CCTVUploadStatus {
  streaming = 'streaming',
  streamed = 'streamed',
  compressing = 'compressing',
  compressed = 'compressed',
  uploading = 'uploading',
  uploaded = 'uploaded',
}
type CCTVSchema = {
  camera: string
  status: CCTVUploadStatus
  duration: number
  inPath: string
  timestamp: string
  uploadCount: number
}
type CCTVPath = {
  in: string
  out: string
  outBasename: string
  withoutExt: string
  basenameWithoutExt: string
}

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
    remoteHost: string
    remoteUsername: string
    remotePassword: string
    remoteRootDir: string
    uploadCompletionTarget: number
  }[] = []
  remote: {
    username: string
    password: string
    ip: string
  }[] = []
  port: number = 8891

  static dbname = path.join(app.getPath('userData'), 'main.db')
  static inExt = '.ts'
  static outExt = '.mp4'
  static uploadStatus = CCTVUploadStatus

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
                //prettier-ignore
                `    runOnRecordSegmentComplete: http://localhost:3000/compressNewRecordings?camera=$MTX_PATH&path=$MTX_SEGMENT_PATH&duration=$MTX_SEGMENT_DURATION`,
                `    runOnRecordSegmentCreate: http://localhost:3000/registerNewRecordings?camera=$MTX_PATH&path=$MTX_SEGMENT_PATH`,
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

  static makePath = (inPath: string | null): CCTVPath | null =>
    inPath === null
      ? null
      : {
          basenameWithoutExt: path.basename(inPath, CCTV.inExt),
          in: inPath,
          out: path.join(
            path.dirname(inPath),
            path.basename(inPath, CCTV.inExt) + CCTV.outExt
          ),
          outBasename: path.basename(inPath, CCTV.inExt) + CCTV.outExt,
          withoutExt: path.join(
            path.dirname(inPath),
            path.basename(inPath, CCTV.inExt)
          ),
        }

  createDb = async () => {
    //TODO REMOVE THIS BLOCK ON NEXT VERSION (0.7.6 or 0.8.0), ITS ONLY A TEMPORARY SOLUTION!!!!
    if (
      !this.trayMenu.dev && //intentionally on prod only!!!
      new Date().getFullYear() === 2025 &&
      new Date().getMonth() + 1 === 7 &&
      new Date().getDate() === 19
    ) {
      try {
        await fs.unlink(CCTV.dbname)
        console.log('0.7.4 DB DELETION -> OK!')
      } catch (_) {
        console.log('0.7.4 DB DELETION -> there was no existing db!')
      }
    }

    const dbiIsCreated = !!(await fs.readdir(path.dirname(CCTV.dbname))).find(
      (f) => f === path.basename(CCTV.dbname)
    )

    const db = await CCTV.getDb()
    if (this.trayMenu.dev) {
      /* try {
        await fs.unlink(CCTV.dbname)
      } catch (_) {
        console.log('there was no existing db!')
      } */
      //await db.exec(`UPDATE cctv SET status = '${CCTV.uploadStatus.ready}'`)
      //await db.exec(`DELETE FROM cctv`)
    }
    if (!dbiIsCreated) {
      new sqlite3.Database(CCTV.dbname)
      await db.exec(
        'CREATE TABLE cctv (camera, inPath, timestamp, duration, status, uploadCount INTEGER DEFAULT 0)'
      )
    }
    await db.exec(
      `DELETE FROM cctv WHERE datetime(timestamp) < datetime('now', '-1 month')`
    )
    await db.close()
  }

  startServices = async () => {
    await this.createDb()
    this.startMediaService()
    this.startMoveLeftoverClipsService()
    this.startSyncDbService()
  }

  private startMediaService = () => {
    const { stdout, stderr } = spawn(this.mediamtxBinaryPath, {
      stdio: 'pipe',
      detached: true,
    })
    stdout.setEncoding('utf8')
    stderr.setEncoding('utf8')
    stdout.on('data', (data) => console.log(data))
    stderr.on('data', (data) => console.log(data))
  }

  static cleanPath = () => {}

  static registerNewRecordings = (express: Express, trayMenu: TrayMenu) => {
    express.get('/registerNewRecordings', async (req, res) => {
      const _path = CCTV.makePath(req.query.path as string | null)
      const camera = req.query.camera as string | null
      if (!_path || !camera) return

      const db = await CCTV.getDb()
      const rawTime = _path.basenameWithoutExt.slice(0, 26)
      await db.exec(
        `INSERT INTO cctv (camera, inPath, timestamp, status)
      VALUES ('${camera}', '${_path.in}', '${`${rawTime.split('_')[0]}T${rawTime
          .split('_')[1]
          .slice(0, 8)
          .replaceAll('-', ':')}.${rawTime.split('-').at(-1)}`}', '${
          CCTV.uploadStatus.streaming
        }')`
      )
      await db.close()
    })
  }

  static compressNewRecordings = (express: Express, trayMenu: TrayMenu) => {
    express.get('/compressNewRecordings', async (req, res) => {
      const _path = CCTV.makePath(req.query.path as string | null)
      const camera = req.query.camera as string | null
      const duration = Number(req.query.duration as string | null)
      if (!_path || !camera || !duration) return

      const db = await CCTV.getDb()
      await CCTV.updateDb(db, _path, {
        duration,
        status: CCTVUploadStatus.streamed,
      })

      const cameraObj = trayMenu.cctv.cameraLogins.find(
        (cl) => cl.username === camera
      )!

      await CCTV.compress(db, trayMenu, _path, duration, camera, cameraObj)
    })
  }

  static compress = async (
    db: Database<sqlite3.Database, sqlite3.Statement>,
    trayMenu: TrayMenu,
    _path: CCTVPath,
    duration: number,
    camera: string,
    cameraObj: CCTVObj
  ): Promise<{ compressed: boolean }> => {
    let result: { compressed: boolean } | undefined = undefined

    await CCTV.updateDb(db, _path, {
      duration,
      status: CCTVUploadStatus.compressing,
    })
    if (cameraObj.enableCompression) {
      console.log('compression is enabled')
      //prettier-ignore
      const command = `${trayMenu.cctv.ffmpegBinaryPath} -hide_banner -loglevel error -i ${_path.in} -vf "scale=${cameraObj.compressedWidth}:-2, fps=${cameraObj.compressedFps}" -b:v ${cameraObj.compressedKbps}k -threads 1 -preset ${cameraObj.encodingPreset} ${_path.out}`
      console.log(command)
      exec(command, async (error, stdout, stderr) => {
        if (error) console.error(error)
        if (stderr) console.error(stderr)
        console.log('compressing done! ->', _path.in)
        await CCTV.updateDb(db, _path, {
          duration,
          status: CCTVUploadStatus.compressed,
        })
        await CCTV.move(camera, _path, duration, cameraObj)
      })
      result = { compressed: true }
    } else {
      console.log('compression is disabled')
      await fs.rename(_path.in, _path.out)

      await CCTV.updateDb(db, _path, {
        duration,
        status: CCTVUploadStatus.compressed,
      })
      await CCTV.move(camera, _path, duration, cameraObj)
      result = { compressed: false }
    }

    await db.close()
    return result
  }

  static getDb = () => open({ filename: CCTV.dbname, driver: sqlite3.Database })

  static updateDb = async (
    db: Database<sqlite3.Database, sqlite3.Statement>,
    path: CCTVPath,
    fields: Partial<CCTVSchema & { incrementUploadCount: boolean }>
  ) => {
    const query = `UPDATE cctv
      SET ${Object.entries(fields)
        .map(
          (f) =>
            `${f[0] === 'incrementUploadCount' ? 'uploadCount' : f[0]} = ${
              f[0] === 'incrementUploadCount'
                ? 'uploadCount + 1'
                : typeof f[1] === 'number'
                ? f[1]
                : `'${f[1]}'`
            }`
        )
        .join(', ')}
      WHERE inPath = '${path.in}'`
    await db.exec(query)
  }

  static move = async (
    camera: string,
    _path: CCTVPath,
    duration: number | null,
    cameraObj: CCTVObj
  ) => {
    duration ??= (cameraObj.segmentDurationInMinutes / 2) * 60 // /2 is an estimation here

    const db = await CCTV.getDb()
    await CCTV.updateDb(db, _path, {
      incrementUploadCount: true,
      duration,
      status: CCTVUploadStatus.uploading,
    })
    const syncResult = await Sync.upload({
      move: true,
      path: _path.out,
      remotePath: `${cameraObj.remoteRootDir}/${camera}/${path.basename(
        _path.outBasename
      )}`,
      throttle: { completionTarget: 0.8, duration }, //TODO: cameraObj.uploadCompletionTarget
      login: {
        host: cameraObj.remoteHost,
        username: cameraObj.remoteUsername,
        password: cameraObj.remotePassword,
      },
    })
    await CCTV.updateDb(db, _path, {
      status: syncResult.ok
        ? CCTV.uploadStatus.uploaded
        : CCTV.uploadStatus.compressed,
    })
    await db.close()
  }

  private startMoveLeftoverClipsService = async () => {
    const db = await CCTV.getDb()
    let leftoverClips = await db.all<
      Pick<
        CCTVSchema,
        'camera' | 'inPath' | 'duration' | 'status' | 'timestamp'
      >[]
    >(
      `SELECT camera, inPath, duration, status, timestamp FROM cctv WHERE status not in (
        '${CCTV.uploadStatus.uploaded}'
      ) ORDER BY datetime(timestamp) ASC LIMIT 10`
    )

    leftoverClips = leftoverClips.filter((lc) => {
      const camaraObj = this.trayMenu.cctv.cameraLogins.find(
        (cl) => cl.username === lc.camera
      )!

      return lc.status === CCTVUploadStatus.compressed ||
        lc.status === CCTVUploadStatus.uploading
        ? Date.now() >
            new Date(lc.timestamp).getTime() +
              (lc.duration
                ? lc.duration * 1000
                : camaraObj.segmentDurationInMinutes * 60 * 1000 * 1.1)
        : true
    })
    for (const clip of leftoverClips.filter(
      (lc) =>
        lc.status === CCTVUploadStatus.streamed ||
        lc.status === CCTVUploadStatus.streaming
    )) {
      //TODO compressing old, but streaming clips first (instead of directly uploading it)
      const _path = CCTV.makePath(clip.inPath)!
      try {
        await fs.rename(_path.in, _path.out)
      } catch (error) {
        console.error('already renamed -> ', _path.in)
      }

      await CCTV.updateDb(db, _path, {
        status: CCTVUploadStatus.compressed,
      })
    }
    await db.close()
    console.log('uploading', leftoverClips.length, 'leftover clips!')

    await Promise.allSettled(
      leftoverClips.map((lc) =>
        CCTV.move(
          lc.camera,
          CCTV.makePath(lc.inPath)!,
          lc.duration,
          this.trayMenu.cctv.cameraLogins.find(
            (cl) => cl.username === lc.camera
          )!
        )
      )
    )

    setTimeout(() => {
      this.startMoveLeftoverClipsService()
    }, 60 * 60 * 1000)
  }

  private startSyncDbService = async () => {
    const syncResult = await Sync.upload({
      path: CCTV.dbname,
      move: false,
      remotePath: `/home/mbene/dbs/${this.trayMenu.locationName}.db`,
      throttle: { completeInSeconds: 10 },
      login: {
        host: process.env.SFTP_HOST!,
        username: process.env.SFTP_USER!,
        password: process.env.SFTP_PWD!,
      },
    })
    if (syncResult.ok) {
      console.log('db synced successfully!')
    } else {
      console.error('db sync errored!')
    }

    setTimeout(() => this.startSyncDbService(), 10 * 60 * 1000)
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
