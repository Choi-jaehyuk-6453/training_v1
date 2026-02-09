import {
  users, sites, trainingMaterials, trainingRecords, notifications,
  type User, type InsertUser,
  type Site, type InsertSite,
  type TrainingMaterial, type InsertTrainingMaterial,
  type TrainingRecord, type InsertTrainingRecord,
  type Notification, type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getGuards(): Promise<User[]>;

  getSites(): Promise<Site[]>;
  getSite(id: string): Promise<Site | undefined>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, site: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<void>;

  getTrainingMaterials(): Promise<TrainingMaterial[]>;
  getTrainingMaterial(id: string): Promise<TrainingMaterial | undefined>;
  createTrainingMaterial(material: InsertTrainingMaterial): Promise<TrainingMaterial>;
  updateTrainingMaterial(id: string, material: Partial<InsertTrainingMaterial>): Promise<TrainingMaterial | undefined>;
  deleteTrainingMaterial(id: string): Promise<void>;

  getTrainingRecords(): Promise<TrainingRecord[]>;
  getTrainingRecordsByGuard(guardId: string): Promise<TrainingRecord[]>;
  createTrainingRecord(record: InsertTrainingRecord): Promise<TrainingRecord>;
  deleteTrainingRecord(id: string): Promise<void>;

  getNotificationsByGuard(guardId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(guardId: string): Promise<void>;
  createNotificationsForAllGuards(materialId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteNotificationIfOwner(id: string, guardId: string): Promise<void>;
  deleteNotificationByMaterialAndGuard(materialId: string, guardId: string): Promise<void>;
  getTrainingStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getGuards(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "guard")).orderBy(desc(users.createdAt));
  }

  async getSites(): Promise<Site[]> {
    return db.select().from(sites).orderBy(desc(sites.createdAt));
  }

  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site || undefined;
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    const [site] = await db.insert(sites).values(insertSite).returning();
    return site;
  }

  async updateSite(id: string, siteData: Partial<InsertSite>): Promise<Site | undefined> {
    const [site] = await db.update(sites).set(siteData).where(eq(sites.id, id)).returning();
    return site || undefined;
  }

  async deleteSite(id: string): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  async getTrainingMaterials(): Promise<TrainingMaterial[]> {
    return db.select().from(trainingMaterials).orderBy(desc(trainingMaterials.createdAt));
  }

  async getTrainingMaterial(id: string): Promise<TrainingMaterial | undefined> {
    const [material] = await db.select().from(trainingMaterials).where(eq(trainingMaterials.id, id));
    return material || undefined;
  }

  async createTrainingMaterial(insertMaterial: InsertTrainingMaterial): Promise<TrainingMaterial> {
    const [material] = await db.insert(trainingMaterials).values(insertMaterial).returning();
    return material;
  }

  async updateTrainingMaterial(id: string, materialData: Partial<InsertTrainingMaterial>): Promise<TrainingMaterial | undefined> {
    const [material] = await db
      .update(trainingMaterials)
      .set({ ...materialData, updatedAt: new Date() })
      .where(eq(trainingMaterials.id, id))
      .returning();
    return material || undefined;
  }

  async deleteTrainingMaterial(id: string): Promise<void> {
    await db.delete(trainingMaterials).where(eq(trainingMaterials.id, id));
  }

  async getTrainingRecords(): Promise<TrainingRecord[]> {
    return db.select().from(trainingRecords).orderBy(desc(trainingRecords.completedAt));
  }

  async getTrainingRecordsByGuard(guardId: string): Promise<TrainingRecord[]> {
    return db.select().from(trainingRecords).where(eq(trainingRecords.guardId, guardId)).orderBy(desc(trainingRecords.completedAt));
  }

  async createTrainingRecord(insertRecord: InsertTrainingRecord): Promise<TrainingRecord> {
    const [record] = await db.insert(trainingRecords).values(insertRecord).returning();
    return record;
  }

  async deleteTrainingRecord(id: string): Promise<void> {
    await db.delete(trainingRecords).where(eq(trainingRecords.id, id));
  }

  async getNotificationsByGuard(guardId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.guardId, guardId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(guardId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.guardId, guardId));
  }

  async createNotificationsForAllGuards(materialId: string): Promise<void> {
    const guards = await this.getGuards();
    const notificationValues = guards.map((guard) => ({
      guardId: guard.id,
      materialId,
      isRead: false,
    }));

    if (notificationValues.length > 0) {
      await db.insert(notifications).values(notificationValues);
    }
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteNotificationIfOwner(id: string, guardId: string): Promise<void> {
    await db.delete(notifications).where(
      and(
        eq(notifications.id, id),
        eq(notifications.guardId, guardId)
      )
    );
  }

  async deleteNotificationByMaterialAndGuard(materialId: string, guardId: string): Promise<void> {
    await db.delete(notifications).where(
      and(
        eq(notifications.materialId, materialId),
        eq(notifications.guardId, guardId)
      )
    );
  }
  async getTrainingStats(): Promise<any> {
    const allSites = await db.select().from(sites);
    const allGuards = await db.select().from(users).where(eq(users.role, "guard"));
    const allMaterials = await db.select().from(trainingMaterials);
    const allRecords = await db.select().from(trainingRecords);

    const stats = allSites.map(site => {
      const siteGuards = allGuards.filter(g => g.siteId === site.id);
      const guardIds = siteGuards.map(g => g.id);

      const totalRequired = siteGuards.length * allMaterials.length;

      const siteRecords = allRecords.filter(r => guardIds.includes(r.guardId));
      const completed = siteRecords.length;

      const rate = totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 0;

      return {
        name: site.name,
        completionRate: rate,
        totalGuards: siteGuards.length,
        completed: completed
      };
    });

    return stats.sort((a, b) => b.completionRate - a.completionRate);
  }
}

export const storage = new DatabaseStorage();
