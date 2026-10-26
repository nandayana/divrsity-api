ALTER TABLE "categories"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "categories"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "categories"
ALTER COLUMN "updated_at"
SET DATA TYPE timestamp with time zone
USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "categories"
ALTER COLUMN "updated_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "products"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "products"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "products"
ALTER COLUMN "updated_at"
SET DATA TYPE timestamp with time zone
USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "products"
ALTER COLUMN "updated_at"
SET DEFAULT now();