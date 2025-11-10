-- Migration: Make PIN unique per depot instead of globally unique
-- This allows the same PIN to exist in different depots

-- Step 1: Remove the existing unique constraint on pin
ALTER TABLE `users` DROP INDEX `users_pin_key`;

-- Step 2: Add a composite unique index on (pin, depot_id)
-- This ensures PIN is unique per depot, but same PIN can exist in different depots
-- Note: MySQL requires that all columns in a unique index are NOT NULL
-- So we need to handle NULL depot_id separately or set a default
ALTER TABLE `users` ADD UNIQUE INDEX `users_pin_depot_id_key` (`pin`, `depot_id`);

-- Note: If there are users with NULL depot_id and same PIN, this migration will fail
-- You may need to assign a default depot to users with NULL depot_id first
-- Example: UPDATE users SET depot_id = 1 WHERE depot_id IS NULL;
