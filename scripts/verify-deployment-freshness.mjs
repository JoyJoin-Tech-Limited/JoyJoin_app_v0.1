import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SHA_PATTERN = /^[0-9a-f]{40}$/

export function verifyDeploymentFreshness(candidateSha, latestMainSha) {
  if (!SHA_PATTERN.test(candidateSha) || !SHA_PATTERN.test(latestMainSha)) {
    throw new Error('Deployment freshness check requires two lowercase 40-character Git SHAs')
  }
  if (candidateSha !== latestMainSha) {
    throw new Error(`Refusing stale deployment: candidate ${candidateSha} is not current main ${latestMainSha}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    verifyDeploymentFreshness(process.argv[2] ?? '', process.argv[3] ?? '')
    process.stdout.write(`Deployment candidate is current main: ${process.argv[2]}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
