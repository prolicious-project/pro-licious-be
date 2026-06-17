ALTER TABLE "riders" ADD COLUMN "rc_number" varchar(30);--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "pan_number" varchar(20);--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "owner_name" varchar(150);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "pan_number" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "fssai_license" varchar(40);