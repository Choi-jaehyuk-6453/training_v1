import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { loginSchema, insertSiteSchema, insertTrainingMaterialSchema, insertTrainingRecordSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "admin" | "guard";
  }
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    return next();
  }
  return res.status(401).json({ message: "로그인이 필요합니다" });
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "관리자 권한이 필요합니다" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy for production (Replit uses reverse proxy)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "guard-training-secret-key-2024",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  registerObjectStorageRoutes(app);

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "입력 정보가 올바르지 않습니다" });
      }

      const { username, password } = result.data;

      if (username === "관리자") {
        if (password === "admin123") {
          const adminUser = await storage.getUserByUsername("관리자");
          let admin = adminUser;
          
          if (!admin) {
            admin = await storage.createUser({
              username: "관리자",
              password: "admin123",
              name: "관리자",
              role: "admin",
              company: "mirae_abm",
            });
          }
          
          req.session.userId = admin.id;
          req.session.role = "admin";
          
          return res.json({ 
            message: "로그인 성공", 
            user: admin 
          });
        }
        return res.status(401).json({ message: "비밀번호가 올바르지 않습니다" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "등록되지 않은 사용자입니다" });
      }

      if (user.role === "admin") {
        return res.status(401).json({ message: "관리자는 '관리자' 아이디로 로그인해주세요" });
      }

      const phoneLastFour = user.phone?.slice(-4) || user.password;
      if (password !== phoneLastFour && password !== user.password) {
        return res.status(401).json({ message: "비밀번호가 올바르지 않습니다" });
      }

      req.session.userId = user.id;
      req.session.role = "guard";

      return res.json({ 
        message: "로그인 성공", 
        user 
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃 실패" });
      }
      res.json({ message: "로그아웃 성공" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
    }

    return res.json({ user });
  });

  app.get("/api/sites", isAuthenticated, async (req, res) => {
    try {
      const sitesData = await storage.getSites();
      const guards = await storage.getGuards();
      
      const sitesWithGuards = sitesData.map((site) => ({
        ...site,
        guards: guards.filter((g) => g.siteId === site.id),
      }));
      
      return res.json(sitesWithGuards);
    } catch (error) {
      console.error("Get sites error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/sites", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = insertSiteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "입력 정보가 올바르지 않습니다" });
      }

      const site = await storage.createSite(result.data);
      return res.json(site);
    } catch (error) {
      console.error("Create site error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.patch("/api/sites/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const site = await storage.updateSite(req.params.id, req.body);
      if (!site) {
        return res.status(404).json({ message: "현장을 찾을 수 없습니다" });
      }
      return res.json(site);
    } catch (error) {
      console.error("Update site error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.delete("/api/sites/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteSite(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      console.error("Delete site error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/guards", isAuthenticated, async (req, res) => {
    try {
      const guards = await storage.getGuards();
      const sitesData = await storage.getSites();
      
      const guardsWithSites = guards.map((guard) => ({
        ...guard,
        site: sitesData.find((s) => s.id === guard.siteId),
      }));
      
      return res.json(guardsWithSites);
    } catch (error) {
      console.error("Get guards error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/guards", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, phone, company, siteId, username, password, role } = req.body;
      
      const existingUser = await storage.getUserByUsername(username || name);
      if (existingUser) {
        return res.status(400).json({ message: "이미 등록된 이름입니다" });
      }

      const guard = await storage.createUser({
        username: username || name,
        password: password || phone?.slice(-4) || "0000",
        name,
        phone,
        company,
        siteId: siteId || null,
        role: role || "guard",
      });
      
      return res.json(guard);
    } catch (error) {
      console.error("Create guard error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.patch("/api/guards/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, phone, company, siteId, username, password } = req.body;
      
      const updateData: any = {};
      if (name) {
        updateData.name = name;
        updateData.username = name;
      }
      if (phone) {
        updateData.phone = phone;
        updateData.password = phone.slice(-4);
      }
      if (company) updateData.company = company;
      if (siteId !== undefined) updateData.siteId = siteId || null;
      
      const guard = await storage.updateUser(req.params.id, updateData);
      if (!guard) {
        return res.status(404).json({ message: "경비원을 찾을 수 없습니다" });
      }
      return res.json(guard);
    } catch (error) {
      console.error("Update guard error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.delete("/api/guards/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      console.error("Delete guard error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/training-materials", isAuthenticated, async (req, res) => {
    try {
      const materials = await storage.getTrainingMaterials();
      return res.json(materials);
    } catch (error) {
      console.error("Get materials error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/training-materials", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = insertTrainingMaterialSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "입력 정보가 올바르지 않습니다", errors: result.error.errors });
      }

      const material = await storage.createTrainingMaterial(result.data);
      
      await storage.createNotificationsForAllGuards(material.id);
      
      return res.json(material);
    } catch (error) {
      console.error("Create material error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.patch("/api/training-materials/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const material = await storage.updateTrainingMaterial(req.params.id, req.body);
      if (!material) {
        return res.status(404).json({ message: "자료를 찾을 수 없습니다" });
      }
      return res.json(material);
    } catch (error) {
      console.error("Update material error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.delete("/api/training-materials/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteTrainingMaterial(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      console.error("Delete material error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/training-records", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const records = await storage.getTrainingRecords();
      const guards = await storage.getGuards();
      const sitesData = await storage.getSites();
      
      const recordsWithGuards = records.map((record) => {
        const guard = guards.find((g) => g.id === record.guardId);
        return {
          ...record,
          guard: guard ? {
            ...guard,
            site: sitesData.find((s) => s.id === guard.siteId),
          } : undefined,
        };
      });
      
      return res.json(recordsWithGuards);
    } catch (error) {
      console.error("Get records error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/training-records/my", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }
      
      const records = await storage.getTrainingRecordsByGuard(req.session.userId);
      return res.json(records);
    } catch (error) {
      console.error("Get my records error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/training-records", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }

      const { materialId, materialType, materialTitle } = req.body;
      
      if (!materialId || !materialType || !materialTitle) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      const record = await storage.createTrainingRecord({
        guardId: req.session.userId,
        materialId,
        materialType,
        materialTitle,
      });
      
      // 이수 완료 시 해당 자료의 알림 삭제
      await storage.deleteNotificationByMaterialAndGuard(materialId, req.session.userId);
      
      return res.json(record);
    } catch (error) {
      console.error("Create record error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }
      
      const notificationsList = await storage.getNotificationsByGuard(req.session.userId);
      const materials = await storage.getTrainingMaterials();
      
      const notificationsWithMaterials = notificationsList.map((notification) => ({
        ...notification,
        material: materials.find((m) => m.id === notification.materialId),
      }));
      
      return res.json(notificationsWithMaterials);
    } catch (error) {
      console.error("Get notifications error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      return res.json({ message: "읽음 처리 완료" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  // 알림 삭제 (클릭 시) - 본인 알림만 삭제 가능
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }
      
      await storage.deleteNotificationIfOwner(req.params.id, req.session.userId);
      return res.json({ message: "알림 삭제 완료" });
    } catch (error) {
      console.error("Delete notification error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "로그인이 필요합니다" });
      }
      
      await storage.markAllNotificationsAsRead(req.session.userId);
      return res.json({ message: "모두 읽음 처리 완료" });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  return httpServer;
}
