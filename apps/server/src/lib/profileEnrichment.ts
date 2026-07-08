import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

interface RegistrationData {
  userId: string;
  eventIntent?: string[];
  preferredLanguages?: string[];
  dietaryRestrictions?: string[];
}

interface EnrichmentResult {
  fieldsUpdated: string[];
  fieldsSkipped: string[];
}

// Allowed intent codes, must stay in sync with registerUserSchema.intent enum
const ALLOWED_EVENT_INTENTS = new Set<string>([
  "networking",
  "friends",
  "discussion",
  "fun",
  "explore",
  "flexible",
]);

type UserProfileUpdates = Partial<
  Pick<typeof users.$inferInsert, "intent" | "preferredLanguages" | "dietaryRestrictions">
>;

/** Returns true when an array field is absent or empty. */
function isArrayFieldEmpty(value: string[] | null | undefined): boolean {
  return !value || value.length === 0;
}

/**
 * Silently enrich user profile from event registration data.
 * Rule: NEVER overwrite existing data — only fill null/empty fields.
 */
export async function enrichProfileFromRegistration(
  data: RegistrationData
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { fieldsUpdated: [], fieldsSkipped: [] };

  // Fetch current user profile (only fields we can enrich)
  const user = await db.query.users.findFirst({
    where: eq(users.id, data.userId),
    columns: {
      intent: true,
      preferredLanguages: true,
      dietaryRestrictions: true,
    },
  });

  if (!user) return result;

  const updates: UserProfileUpdates = {};

  // Intent: only fill if profile intent is empty/null
  if (data.eventIntent?.length) {
    const validEventIntents = data.eventIntent.filter((intent) =>
      ALLOWED_EVENT_INTENTS.has(intent)
    );

    if (validEventIntents.length === 0) {
      // Registration provided only invalid values; do not update profile intent
      result.fieldsSkipped.push("intent");
    } else if (isArrayFieldEmpty(user.intent)) {
      updates.intent = validEventIntents;
      result.fieldsUpdated.push("intent");
    } else {
      result.fieldsSkipped.push("intent");
    }
  }

  // preferredLanguages: only fill if profile field is empty/null (save time on re-registration)
  if (data.preferredLanguages?.length) {
    if (isArrayFieldEmpty(user.preferredLanguages)) {
      updates.preferredLanguages = data.preferredLanguages;
      result.fieldsUpdated.push("preferredLanguages");
    } else {
      result.fieldsSkipped.push("preferredLanguages");
    }
  }

  // dietaryRestrictions: only fill if profile field is empty/null
  if (data.dietaryRestrictions?.length) {
    if (isArrayFieldEmpty(user.dietaryRestrictions)) {
      updates.dietaryRestrictions = data.dietaryRestrictions;
      result.fieldsUpdated.push("dietaryRestrictions");
    } else {
      result.fieldsSkipped.push("dietaryRestrictions");
    }
  }

  // Apply updates if any
  if (Object.keys(updates).length > 0) {
    await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, data.userId));
  }

  if (result.fieldsUpdated.length > 0) {
    console.log(
      `[profileEnrichment] User ${data.userId}: enriched fields [${result.fieldsUpdated.join(", ")}], skipped [${result.fieldsSkipped.join(", ")}]`
    );
  }

  return result;
}
