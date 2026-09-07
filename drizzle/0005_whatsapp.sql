CREATE TYPE "public"."wa_campaign_status" AS ENUM('draft', 'scheduled', 'running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wa_recipient_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."wa_message_status" AS ENUM('received', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wa_message_type" AS ENUM('text', 'template', 'image', 'document', 'interactive', 'system');--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"message_id" uuid,
	"status" "wa_recipient_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "campaign_recipient_unique" UNIQUE("campaign_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "wa_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"template_id" uuid NOT NULL,
	"audience_filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "wa_campaign_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"sent_count" text DEFAULT '0' NOT NULL,
	"failed_count" text DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wa_phone" text NOT NULL,
	"name" text,
	"push_name" text,
	"lead_id" uuid,
	"customer_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"opted_in" boolean DEFAULT true NOT NULL,
	"assigned_to" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_contacts_wa_phone_unique" UNIQUE("wa_phone")
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wa_message_id" text,
	"contact_id" uuid NOT NULL,
	"direction" "wa_direction" NOT NULL,
	"type" "wa_message_type" DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"template_name" text,
	"payload" jsonb,
	"status" "wa_message_status" DEFAULT 'sent' NOT NULL,
	"error_code" text,
	"error_message" text,
	"campaign_id" uuid,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_messages_wa_message_id_unique" UNIQUE("wa_message_id")
);
--> statement-breakpoint
CREATE TABLE "wa_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meta_template_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"components" jsonb,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_templates_meta_template_id_unique" UNIQUE("meta_template_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_wa_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."wa_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_wa_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."wa_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_message_id_wa_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."wa_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD CONSTRAINT "wa_campaigns_template_id_wa_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."wa_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_campaigns" ADD CONSTRAINT "wa_campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_contacts" ADD CONSTRAINT "wa_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_contacts" ADD CONSTRAINT "wa_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_contacts" ADD CONSTRAINT "wa_contacts_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_contact_id_wa_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."wa_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_recipients_campaign_idx" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "wa_campaigns_status_idx" ON "wa_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wa_contacts_last_message_idx" ON "wa_contacts" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "wa_contacts_assigned_idx" ON "wa_contacts" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "wa_messages_contact_ts_idx" ON "wa_messages" USING btree ("contact_id","timestamp");--> statement-breakpoint
CREATE INDEX "wa_messages_campaign_idx" ON "wa_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "wa_templates_status_idx" ON "wa_templates" USING btree ("status");