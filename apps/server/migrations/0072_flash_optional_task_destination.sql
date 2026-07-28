-- Additive compatibility migration:
-- new life invitations and digital-NPC relay tasks have no destination;
-- legacy destination_exploration assignments keep their existing FK value.
ALTER TABLE "flash_task_assignments"
  ALTER COLUMN "destination_id" DROP NOT NULL;
