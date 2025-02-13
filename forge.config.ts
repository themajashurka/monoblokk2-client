import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import path from 'path'
import fs from 'fs/promises'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    /* extraResource: [
      '.env',
      'speedtest_binary',
      'mediamtx_binary',
      'ffmpeg_binary',
      'rclone_binary',
      'print_test.pdf',
      'mediamtx_template.yml',
    ], */
    extraResource: [
      '.env',
      'speedtest_binary_win32',
      'mediamtx_binary_win32',
      'ffmpeg_binary_win32',
      'print_test.pdf',
      'mediamtx_template.yml',
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    packageAfterPrune: async (_config, buildPath) => {
      const gypPath = path.join(
        buildPath,
        'node_modules',
        '@thiagoelg/node-printer',
        'build',
        'node_gyp_bins'
      )
      await fs.rm(gypPath, { recursive: true, force: true })
      const gypPathUsb = path.join(
        buildPath,
        'node_modules',
        'usb',
        'build',
        'node_gyp_bins'
      )
      await fs.rm(gypPathUsb, { recursive: true, force: true })
    },
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'themajashurka',
          name: 'monoblokk2-client',
        },
        force: true,
        draft: false,
      },
    },
  ],
}

export default config
