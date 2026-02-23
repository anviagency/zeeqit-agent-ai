import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.zeeqit.app',
  productName: 'Zeeqit',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  files: [
    'out/**/*',
    'resources/runtime/manifest.json'
  ],
  extraResources: [
    {
      from: 'resources/runtime',
      to: 'runtime',
      filter: ['manifest.json', 'node-${os}-${arch}/**/*']
    }
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64']
      }
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: false
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] }
    ],
    category: 'Development',
    maintainer: 'Zeeqit <support@zeeqit.com>',
    desktop: {
      Name: 'Zeeqit',
      Comment: 'Local AI Worker Control Plane',
      Categories: 'Development;Utility'
    }
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] }
    ],
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    installerIcon: 'resources/icon.png',
    uninstallerIcon: 'resources/icon.png'
  },
  publish: {
    provider: 'generic',
    url: 'https://releases.zeeqit.com'
  }
}

export default config
