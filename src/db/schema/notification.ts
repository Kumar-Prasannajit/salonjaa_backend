import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { notificationTypeEnum, notificationStatusEnum } from "@/db/schema/enums";
import { users } from "@/db/schema/identity";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    subject: varchar("subject", { length: 255 }),
    message: text("message").notNull(),
    status: notificationStatusEnum("status").notNull().default("PENDING"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userStatusIdx: index("notifications_user_status_idx").on(table.userId, table.status, table.createdAt),
    statusCreatedIdx: index("notifications_status_created_idx").on(table.status, table.createdAt),
  })
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 150 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    subjectTemplate: varchar("subject_template", { length: 255 }),
    bodyTemplate: text("body_template").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: uniqueIndex("notification_templates_name_unique").on(table.name),
    activeEventIdx: index("notification_templates_active_event_idx").on(table.active, table.eventType),
  })
);
