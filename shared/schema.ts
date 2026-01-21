import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "guard"]);
export const companyEnum = pgEnum("company", ["mirae_abm", "dawon_pmc"]);
export const materialTypeEnum = pgEnum("material_type", ["card", "video"]);

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: companyEnum("company").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sitesRelations = relations(sites, ({ many }) => ({
  guards: many(users),
}));

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("guard"),
  company: companyEnum("company"),
  siteId: varchar("site_id").references(() => sites.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  site: one(sites, {
    fields: [users.siteId],
    references: [sites.id],
  }),
  trainingRecords: many(trainingRecords),
  notifications: many(notifications),
}));

export const trainingMaterials = pgTable("training_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: materialTypeEnum("type").notNull(),
  videoUrl: text("video_url"),
  cardImages: text("card_images").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainingMaterialsRelations = relations(trainingMaterials, ({ many }) => ({
  trainingRecords: many(trainingRecords),
  notifications: many(notifications),
}));

export const trainingRecords = pgTable("training_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guardId: varchar("guard_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").notNull().references(() => trainingMaterials.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  materialType: materialTypeEnum("material_type").notNull(),
  materialTitle: text("material_title").notNull(),
});

export const trainingRecordsRelations = relations(trainingRecords, ({ one }) => ({
  guard: one(users, {
    fields: [trainingRecords.guardId],
    references: [users.id],
  }),
  material: one(trainingMaterials, {
    fields: [trainingRecords.materialId],
    references: [trainingMaterials.id],
  }),
}));

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guardId: varchar("guard_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialId: varchar("material_id").notNull().references(() => trainingMaterials.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  guard: one(users, {
    fields: [notifications.guardId],
    references: [users.id],
  }),
  material: one(trainingMaterials, {
    fields: [notifications.materialId],
    references: [trainingMaterials.id],
  }),
}));

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTrainingMaterialSchema = createInsertSchema(trainingMaterials).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrainingRecordSchema = createInsertSchema(trainingRecords).omit({ id: true, completedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TrainingMaterial = typeof trainingMaterials.$inferSelect;
export type InsertTrainingMaterial = z.infer<typeof insertTrainingMaterialSchema>;

export type TrainingRecord = typeof trainingRecords.$inferSelect;
export type InsertTrainingRecord = z.infer<typeof insertTrainingRecordSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
  role: z.enum(["admin", "guard"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
