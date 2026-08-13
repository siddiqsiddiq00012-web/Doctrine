DROP INDEX `task_executions_key_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `task_executions_key_idx` ON `task_executions` (`daily_execution_id`,`task_key`);