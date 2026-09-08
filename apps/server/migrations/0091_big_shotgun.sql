-- Custom SQL migration file, put your code below! --
-- invitation_uses duo-bind lookup indexes (inviter-side by invitation_id,
-- invitee-side by pool_registration_id) — mirrors the Drizzle schema
-- definition added in packages/shared/src/schema/_definitions.ts.
CREATE INDEX IF NOT EXISTS idx_invitation_uses_invitation_id ON invitation_uses (invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_uses_pool_registration_id ON invitation_uses (pool_registration_id);
