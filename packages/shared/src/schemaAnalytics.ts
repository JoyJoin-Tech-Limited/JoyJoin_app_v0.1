import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { socialIcebreakerSessions } from './schema';

/**
 * Server-only MiniScript secrets for the Mini Script phase.
 *
 * Stores solution, playerKnowledge, redHerrings, deductionChain, and all clues
 * (including unrevealed) separately from the public session state so they are
 * never accidentally exposed to clients via the state polling endpoint.
 */
export const socialIcebreakerMiniscriptSecrets = pgTable(
  'social_icebreaker_miniscript_secrets',
  {
    socialSessionId: varchar('social_session_id', { length: 64 }).primaryKey().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
    secretsJson: text('secrets_json').notNull(), // encrypted/serialized server-only data
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_miniscript_secrets_session').on(table.socialSessionId)],
);
