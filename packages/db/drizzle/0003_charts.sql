CREATE TABLE "chart" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"query_id" text NOT NULL,
	"name" text NOT NULL,
	"spec" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chart" ADD CONSTRAINT "chart_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart" ADD CONSTRAINT "chart_query_id_saved_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."saved_query"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart" ADD CONSTRAINT "chart_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chart_workspace_idx" ON "chart" USING btree ("workspace_id","updated_at");