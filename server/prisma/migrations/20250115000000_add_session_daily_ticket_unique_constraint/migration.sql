-- CreateIndex
CREATE UNIQUE INDEX `unique_session_daily_ticket` ON `sales`(`session_id`, `daily_ticket_number`);
