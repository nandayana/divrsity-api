ALTER TABLE "shipping" ADD COLUMN "awb" varchar(255);--> statement-breakpoint
ALTER TABLE "shipping" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping" ADD CONSTRAINT "shipping_awb_unique" UNIQUE("awb");