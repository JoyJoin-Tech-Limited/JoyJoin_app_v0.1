import path from 'node:path';
import {
  getImpactForFile,
  platformMapPath,
  repoRoot,
  toRepoRelative,
} from '../platform-coordination.mjs';

const DIRECT_PLATFORM_API_MESSAGE = 'Shared platform-agnostic code must not call platform APIs directly. Inject an adapter instead.';

function isPlatformAgnostic(sourceCode) {
  return sourceCode.getAllComments().some((comment) => comment.value.includes('@platform-agnostic'));
}

function isWindowLocation(node) {
  return node.object.type === 'Identifier'
    && node.object.name === 'window'
    && node.property.type === 'Identifier'
    && node.property.name === 'location';
}

function isTaroMember(node) {
  return node.object.type === 'Identifier' && node.object.name === 'Taro';
}

function isWxMember(node) {
  return node.object.type === 'Identifier' && node.object.name === 'wx';
}

const noDirectPlatformApi = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct platform API usage in platform-agnostic files.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    if (!isPlatformAgnostic(sourceCode)) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (
          (isWxMember(node) || isTaroMember(node) || isWindowLocation(node))
          && !node.computed
        ) {
          context.report({
            node,
            message: DIRECT_PLATFORM_API_MESSAGE,
          });
        }
      },
    };
  },
};

const requireSiblingUpdate = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require PRIMARY changes to include a sibling review signal.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          changedFiles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const changedFiles = new Set((options.changedFiles ?? []).map((file) => toRepoRelative(file)));
    const filename = context.getFilename();
    const repoRelative = path.isAbsolute(filename)
      ? toRepoRelative(filename)
      : filename;

    if (!changedFiles.has(repoRelative)) {
      return {};
    }

    const [impact] = getImpactForFile(repoRelative);
    if (!impact || impact.root.role !== 'PRIMARY') {
      return {};
    }

    const hasCompanionChange = [
      ...impact.siblings.map((sibling) => sibling.file),
      ...impact.sharedDependencies,
    ].some((candidate) => changedFiles.has(candidate));

    if (hasCompanionChange) {
      return {};
    }

    return {
      Program(node) {
        const siblingTargets = impact.siblings.map((sibling) => `${sibling.file} (${sibling.role})`);
        const contractTargets = impact.sharedDependencies;
        const targets = [...siblingTargets, ...contractTargets].join(', ');
        context.report({
          node,
          message: `PRIMARY file changed without a coordinated sibling update. Review ${targets || platformMapPath.replace(`${repoRoot}/`, '')}.`,
        });
      },
    };
  },
};

export default {
  rules: {
    'no-direct-platform-api': noDirectPlatformApi,
    'require-sibling-update': requireSiblingUpdate,
  },
};
