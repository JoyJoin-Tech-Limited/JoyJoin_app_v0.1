import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..');
const platformMapPath = path.join(__dirname, 'platform-map.json');

function normalizePath(input) {
  const normalized = input.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : normalized.replace(/^\.\//, '');
}

export function toRepoRelative(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
  const relative = path.relative(repoRoot, absolute);
  return normalizePath(relative);
}

export function loadPlatformMap() {
  const parsed = JSON.parse(fs.readFileSync(platformMapPath, 'utf8'));
  return parsed.entries.map((entry) => ({
    ...entry,
    roots: entry.roots.map((root) => ({
      ...root,
      path: normalizePath(root.path),
    })),
    sharedDependencies: (entry.sharedDependencies ?? []).map(normalizePath),
  }));
}

function findRootMatch(filePath, entry) {
  return entry.roots.find((root) => filePath === root.path || filePath.startsWith(`${root.path}/`));
}

function findDependencyMatch(filePath, entry) {
  return entry.sharedDependencies.find((dependency) => filePath === dependency || filePath.startsWith(`${dependency}/`));
}

function relativeWithinRoot(filePath, rootPath) {
  if (filePath === rootPath) {
    return '';
  }
  return normalizePath(path.posix.relative(rootPath, filePath));
}

function counterpartFile(root, relativePath) {
  return relativePath ? normalizePath(path.posix.join(root.path, relativePath)) : root.path;
}

export function getImpactForFile(filePath) {
  const repoRelative = toRepoRelative(filePath);
  const entries = loadPlatformMap();
  const impacts = [];

  for (const entry of entries) {
    const matchedRoot = findRootMatch(repoRelative, entry);
    if (matchedRoot) {
      const relativePath = relativeWithinRoot(repoRelative, matchedRoot.path);
      const siblings = entry.roots
        .filter((root) => root.path !== matchedRoot.path)
        .map((root) => ({
          ...root,
          file: counterpartFile(root, relativePath),
        }));

      const actionRequired =
        matchedRoot.role === 'PRIMARY'
          ? siblings.length > 0
            ? `Ensure logic changes are reviewed in ${siblings.map((sibling) => sibling.platform).join(', ')}.`
            : 'Review shared dependencies before merging.'
          : matchedRoot.role === 'SECONDARY'
            ? siblings.length > 0
              ? `Prefer updating ${siblings[0].platform} first when business logic changes.`
              : 'Keep this derived implementation aligned with its PRIMARY counterpart.'
            : 'Update all consuming coordinated features if the contract changes.';

      impacts.push({
        file: repoRelative,
        entryName: entry.name,
        description: entry.description,
        root: matchedRoot,
        siblings,
        sharedDependencies: entry.sharedDependencies,
        actionRequired,
      });
      continue;
    }

    const matchedDependency = findDependencyMatch(repoRelative, entry);
    if (matchedDependency) {
      impacts.push({
        file: repoRelative,
        entryName: entry.name,
        description: entry.description,
        root: {
          path: matchedDependency,
          platform: 'shared',
          role: 'SHARED',
        },
        siblings: entry.roots.map((root) => ({
          ...root,
          file: root.path,
        })),
        sharedDependencies: entry.sharedDependencies,
        actionRequired: `Review all coordinated consumers: ${entry.roots.map((root) => root.platform).join(', ')}.`,
      });
    }
  }

  return impacts;
}

export function getCoordinatedFiles() {
  const entries = loadPlatformMap();
  const fileSet = new Set();

  for (const entry of entries) {
    for (const root of entry.roots) {
      const absoluteRoot = path.join(repoRoot, root.path);
      if (!fs.existsSync(absoluteRoot)) {
        continue;
      }

      const stats = fs.statSync(absoluteRoot);
      if (stats.isFile()) {
        fileSet.add(root.path);
        continue;
      }

      for (const child of fs.readdirSync(absoluteRoot)) {
        if (child === '.platform') {
          continue;
        }
        const childPath = path.join(absoluteRoot, child);
        if (fs.statSync(childPath).isFile()) {
          fileSet.add(normalizePath(path.relative(repoRoot, childPath)));
        }
      }
    }
  }

  return Array.from(fileSet).sort();
}

export function getChangedFiles({ staged = false, baseRef = null, headRef = null, files = [] } = {}) {
  if (files.length > 0) {
    return files.map(toRepoRelative);
  }

  const args = ['diff', '--name-only'];
  if (staged) {
    args.push('--cached');
  }
  if (baseRef && headRef) {
    args.push(baseRef, headRef);
  }

  const stdout = execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  if (!stdout) {
    return [];
  }

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizePath);
}

export function formatImpactText(impacts) {
  return impacts.map((impact) => {
    const lines = [
      `📁 ${impact.file}`,
      `   Coordination Area: ${impact.entryName}`,
      `   Platform Role: ${impact.root.role}`,
    ];

    for (const sibling of impact.siblings) {
      lines.push(`   ⚠️  Sibling file: ${sibling.file} (${sibling.role})`);
    }

    if (impact.sharedDependencies.length > 0) {
      lines.push(`   Shared dependencies: ${impact.sharedDependencies.join(', ')}`);
    }

    lines.push(`   Action Required: ${impact.actionRequired}`);
    return lines.join('\n');
  }).join('\n\n');
}

export function formatImpactSummary(impacts) {
  if (impacts.length === 0) {
    return '✅ No coordinated platform files were staged.';
  }

  const lines = ['⚠️  Platform Impact Summary:'];
  for (const impact of impacts) {
    lines.push(`   - ${impact.file} (${impact.root.role}) changed.`);
    for (const sibling of impact.siblings) {
      lines.push(`   - Review ${sibling.file} (${sibling.role}).`);
    }
    for (const dependency of impact.sharedDependencies) {
      lines.push(`   - Check shared contract: ${dependency}.`);
    }
  }
  return lines.join('\n');
}

export function formatImpactMarkdown(impacts) {
  if (impacts.length === 0) {
    return '✅ No coordinated platform files changed.';
  }

  const sections = ['## Platform coordination impact'];
  for (const impact of impacts) {
    sections.push(`- **${impact.file}** — ${impact.root.role} in \`${impact.entryName}\``);
    for (const sibling of impact.siblings) {
      sections.push(`  - Review sibling: \`${sibling.file}\` (${sibling.role})`);
    }
    for (const dependency of impact.sharedDependencies) {
      sections.push(`  - Shared dependency: \`${dependency}\``);
    }
    sections.push(`  - Action: ${impact.actionRequired}`);
  }
  return sections.join('\n');
}

export { platformMapPath };
