import type { LieDetectiveStatement } from '@shared/socialIcebreaker';

const CUSTOM_STATEMENT_MIN_LENGTH = 2;
const CUSTOM_STATEMENT_MAX_LENGTH = 80;

export function resolveLieDetectiveTargetUserId(
  clientTargetUserId: string,
  botPersonas?: Array<{ botId: string; userId: string }>,
): string {
  return botPersonas?.find((persona) => persona.botId === clientTargetUserId)?.userId
    ?? clientTargetUserId;
}

export function buildCustomLieDetectiveStatements(
  rawStatements: unknown,
  lieIndex: unknown,
): LieDetectiveStatement[] {
  if (!Array.isArray(rawStatements) || rawStatements.length !== 3) {
    throw new Error('Exactly three statements are required');
  }
  if (!Number.isInteger(lieIndex) || Number(lieIndex) < 1 || Number(lieIndex) > 3) {
    throw new Error('lieIndex must be 1, 2, or 3');
  }

  const statements = rawStatements.map((value) => {
    if (typeof value !== 'string') {
      throw new Error('Every statement must be text');
    }
    const text = value.trim();
    if (text.length < CUSTOM_STATEMENT_MIN_LENGTH || text.length > CUSTOM_STATEMENT_MAX_LENGTH) {
      throw new Error(`Every statement must be ${CUSTOM_STATEMENT_MIN_LENGTH}-${CUSTOM_STATEMENT_MAX_LENGTH} characters`);
    }
    return text;
  });

  if (new Set(statements).size !== statements.length) {
    throw new Error('Statements must be different from each other');
  }

  return statements.map((text, index) => ({
    index: index + 1,
    text,
    isLie: index + 1 === lieIndex,
  }));
}
