ALTER TABLE "auth"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "auth"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "auth"
ALTER COLUMN "updated_at"
SET DATA TYPE timestamp with time zone
USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "auth"
ALTER COLUMN "updated_at"
SET DEFAULT now();--> statement-breakpoint


ALTER TABLE "refresh_token"
ALTER COLUMN "expired_at"
SET DATA TYPE timestamp with time zone
USING "expired_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "refresh_token"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "refresh_token"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint


ALTER TABLE "user"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "user"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint


ALTER TABLE "cart_items"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "cart_items"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "cart_items"
ALTER COLUMN "updated_at"
SET DATA TYPE timestamp with time zone
USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "cart_items"
ALTER COLUMN "updated_at"
SET DEFAULT now();--> statement-breakpoint


ALTER TABLE "carts"
ALTER COLUMN "expires_at"
SET DATA TYPE timestamp with time zone
USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "carts"
ALTER COLUMN "created_at"
SET DATA TYPE timestamp with time zone
USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "carts"
ALTER COLUMN "created_at"
SET DEFAULT now();--> statement-breakpoint

ALTER TABLE "carts"
ALTER COLUMN "updated_at"
SET DATA TYPE timestamp with time zone
USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint

ALTER TABLE "carts"
ALTER COLUMN "updated_at"
SET DEFAULT now();