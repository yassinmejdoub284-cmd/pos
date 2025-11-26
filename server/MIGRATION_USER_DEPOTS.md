# Migration Guide: User Multiple Depots Support

## Steps to Enable Multiple Depot Assignment for Users

### 1. Stop the Server
Stop your Node.js server if it's currently running.

### 2. Create the Database Table
Run the SQL migration to create the `user_depots` table:

**Option A: Using MySQL command line**
```bash
mysql -u your_username -p your_database_name < prisma/migrations/create_user_depots_table.sql
```

**Option B: Using a database client**
Copy and paste the SQL from `prisma/migrations/create_user_depots_table.sql` into your MySQL client and execute it.

**Option C: Direct SQL**
```sql
CREATE TABLE IF NOT EXISTS `user_depots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `depot_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_depots_user_id_depot_id_key` (`user_id`, `depot_id`),
  INDEX `user_depots_user_id_fkey` (`user_id`),
  INDEX `user_depots_depot_id_fkey` (`depot_id`),
  CONSTRAINT `user_depots_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_depots_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. Regenerate Prisma Client
After creating the table, regenerate the Prisma client:

```bash
cd server
npx prisma generate
```

### 4. Restart the Server
Start your server again. The multiple depot assignment feature will now work!

## What This Enables

- Users can be assigned to multiple depots
- All selected depot IDs are saved in the `user_depots` table
- The UI allows selecting multiple depots when creating/editing users
- Super admin can filter users by multiple depots

## Notes

- The code includes graceful fallback: if the table doesn't exist yet, it will use the single `depotId` field
- After migration, all new user assignments will save multiple depots
- Existing users with single depot assignments will continue to work


