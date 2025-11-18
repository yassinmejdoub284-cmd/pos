-- Script to grant a user access to both depots:
-- 1. Boutique Centre Ville Sfax (depot ID: 3)
-- 2. Boutique Ariena (depot ID: 4)
--
-- Usage: Replace <USER_ID> with the actual user ID
-- Example: UPDATE users_enterprise SET depot_id = 3 WHERE id = 5;

-- First, let's see the available depots
SELECT id, name, code, city FROM depots 
WHERE id IN (3, 4) OR name LIKE '%Ariena%' OR name LIKE '%Ariana%' OR name LIKE '%Centre Ville%';

-- List users to find the one you want to update
-- SELECT id, username, first_name, last_name, role, depot_id FROM users_enterprise WHERE is_active = 1;

-- Update user's primary depot to Boutique Centre Ville (depot 3)
-- User can access Ariena (depot 4) via visiting depot mechanism
-- UPDATE users_enterprise SET depot_id = 3 WHERE id = <USER_ID>;

-- Note: After this update:
-- - Primary access: Boutique Centre Ville (depot 3) - direct access
-- - Secondary access: Boutique Ariena (depot 4) - via visiting depot header (x-depot-id)

