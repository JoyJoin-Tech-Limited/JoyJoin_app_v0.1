const AVATAR_3D_CHUNK_NAME = 'pages/profile-linked/three-avatar'
const MAIN_PACKAGE = 'main'

const SUBPACKAGE_ROOTS = [
  'pages/onboarding',
  'pages/profile-linked',
  'pages/icebreaker-session',
  'pages/matching-status',
  'pages/pool-registration',
  'pages/squad-unboxing',
  'pages/pool-group-detail',
  'pages/gathering-room',
  'pages/payments',
  'pages/alang',
  'pages/alang-story',
  'pages/event-feedback',
  'pages/city-unlock',
  'pages/event-coordination',
  'pages/center-tab-empty',
] as const

const REG_TARO_SCOPED_PACKAGE = /@tarojs[\\/][a-z]+/
const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi

export interface ManualChunksModuleInfo {
  importers?: string[]
  dynamicImporters?: string[]
  isEntry?: boolean
}

export interface ManualChunksApi {
  getModuleInfo: (moduleId: string) => ManualChunksModuleInfo | null
}

function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, '/')
}

function packageForModule(id: string): string | null {
  const normalized = normalizeModuleId(id)
  for (const root of SUBPACKAGE_ROOTS) {
    if (normalized.includes(`/src/${root}/`)) return root
  }
  return normalized.includes('/src/pages/') || /\/src\/app\.[cm]?[jt]sx?(?:$|\?)/.test(normalized)
    ? MAIN_PACKAGE
    : null
}

function dependentPackages(id: string, api: ManualChunksApi): Set<string> {
  const packages = new Set<string>()
  const queue: Array<{ id: string; packageHint: string | null }> = [
    { id, packageHint: packageForModule(id) },
  ]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    const visitKey = `${current.id}\0${current.packageHint ?? ''}`
    if (visited.has(visitKey)) continue
    visited.add(visitKey)

    const currentPackage = packageForModule(current.id) ?? current.packageHint
    const info = api.getModuleInfo(current.id)
    const importers = [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])]

    if (info?.isEntry || importers.length === 0) {
      packages.add(currentPackage ?? MAIN_PACKAGE)
      continue
    }

    for (const importer of importers) {
      queue.push({
        id: importer,
        packageHint: packageForModule(importer) ?? currentPackage,
      })
    }
  }

  return packages
}

/**
 * Keep modules that are shared only inside one WeChat subpackage inside that
 * subpackage. Taro's default Vite split puts every module with multiple
 * importers in root common.js, even when the main package never uses it.
 */
export function miniProgramManualChunks(
  id: string,
  api: ManualChunksApi,
): string | null | undefined {
  const normalizedId = normalizeModuleId(id)
  if (
    /node_modules[\\/]three[\\/]/.test(id) ||
    /[\\/]src[\\/]lib[\\/]profile[\\/]avatar3d[\\/]/.test(id) ||
    /[\\/]src[\\/]components[\\/]profile[\\/]PixelAvatar3D\.tsx$/.test(id)
  ) {
    return AVATAR_3D_CHUNK_NAME
  }

  REG_NODE_MODULES_DIR.lastIndex = 0
  if (/node_modules[\\/]@tarojs[\\/]vite-runner/.test(id)) return null
  if (/node_modules[\\/]@babel[\\/]/.test(id) || /commonjsHelpers\.js$/.test(id)) {
    return 'babelHelpers'
  }
  if (
    REG_TARO_SCOPED_PACKAGE.test(id) ||
    /node_modules[\\/](react-reconciler|react|scheduler|tslib)[\\/]/.test(id)
  ) {
    return 'taro'
  }
  if (REG_NODE_MODULES_DIR.test(id)) return 'vendors'

  const moduleInfo = api.getModuleInfo(id)
  const importerCount =
    (moduleInfo?.importers?.length ?? 0) + (moduleInfo?.dynamicImporters?.length ?? 0)
  if (moduleInfo && !moduleInfo.isEntry && importerCount > 1) {
    const packages = dependentPackages(id, api)
    if (packages.size === 1) {
      const [onlyPackage] = packages
      if (onlyPackage !== MAIN_PACKAGE) return `${onlyPackage}/sub-common`
    }
  }
  if (importerCount > 1) {
    return 'common'
  }
  return undefined
}
