import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSiteSchema, insertTrainingMaterialSchema, insertTrainingRecordSchema } from "@shared/schema";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import multer from "multer";
import * as XLSX from "xlsx";

// Configure Multer (Memory Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit for video files
  },
});

// Initialize Supabase Client Variable (lazy init)
let supabase: ReturnType<typeof createClient>;

// Middleware to verify Supabase Token
async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "인증 토큰이 없습니다" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
    }

    // Attach user to req (we'll fetch the profile from public.users next)
    let profile = null;
    try {
      profile = await storage.getUser(user.id);
    } catch (e) {
      console.error("Storage getUser error:", e);
    }

    (req as any).user = profile || { id: user.id, role: user.user_metadata?.role || "guard" };
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(500).json({ message: "인증 처리 중 오류 발생" });
  }
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user && user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "관리자 권한이 필요합니다" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  console.log("Registering Routes..."); // Debug log

  // Initialize Supabase Client with Service Role Key
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Doing it here ensures env vars are loaded.
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Trust proxy for production (Replit uses reverse proxy)
  app.set("trust proxy", 1);

  app.get("/api/health", (_req, res) => {
    return res.json({ status: "ok" });
  });

  // Auth Routes
  // Login is handled on client. 
  // We provide 'me' to fetch profile.

  // Auth Routes
  // Server-side login to handle Korean usernames (maps Name -> Phone Email)
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      let email = "";

      if (username === "관리자") {
        email = "admin@example.com";
      } else {
        // Look up user by username (Name) to find their phone number
        const user = await storage.getUserByUsername(username);
        if (!user || !user.phone) {
          return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
        }
        email = `${user.phone}@example.com`;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ message: "로그인 실패: " + error.message });
      }

      return res.json({ session: data.session, user: data.user });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
    }
    // If the user object is just the Supabase user partial (no full profile), try fetching again
    const fullProfile = await storage.getUser(user.id);
    return res.json({ user: fullProfile || user });
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
      const site = await storage.updateSite(req.params.id as string, req.body);
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
      await storage.deleteSite(req.params.id as string);
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

      // 1. Check if username/email exists in our DB (optional but good)
      // 2. Create user in Supabase Auth
      // We will use username as email: username@training.com (or similar dummy domain)
      // OR use the loginSchema

      // Use phone number as email identifier since username (Name) can be Korean (invalid for email)
      // Format: 01012345678@example.com
      const email = username === "관리자" ? "admin@example.com" : `${phone}@example.com`;

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password || phone?.slice(-4) || "0000",
        email_confirm: true,
        user_metadata: { role: role || "guard", name: name }
      });

      if (authError) {
        return res.status(400).json({ message: "Supabase 계정 생성 실패: " + authError.message });
      }

      if (!authUser.user) {
        return res.status(500).json({ message: "계정 생성 실패" });
      }

      // 3. Create profile in public.users
      const guard = await storage.createUser({
        id: authUser.user.id, // Use Supabase ID
        username: username || name,
        password: "MANAGED_BY_SUPABASE", // Password is in Supabase
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

      // Note: Updating password in Supabase requires admin API if we want to do it here
      if (password) {
        const { error } = await supabase.auth.admin.updateUserById(req.params.id as string, {
          password: password
        });
        if (error) {
          console.error("Supabase password update failed", error);
        }
      }

      const updateData: any = {};
      if (name) {
        updateData.name = name;
        updateData.username = name;
      }
      if (phone) {
        updateData.phone = phone;
      }
      if (company) updateData.company = company;
      if (siteId !== undefined) updateData.siteId = siteId || null;

      const guard = await storage.updateUser(req.params.id as string, updateData);
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
      // Delete from Supabase Auth
      await supabase.auth.admin.deleteUser(req.params.id as string);

      // Delete from public.users
      await storage.deleteUser(req.params.id as string);

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
      const material = await storage.updateTrainingMaterial(req.params.id as string, req.body);
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
      await storage.deleteTrainingMaterial(req.params.id as string);
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
      const user = (req as any).user;
      const records = await storage.getTrainingRecordsByGuard(user.id);
      return res.json(records);
    } catch (error) {
      console.error("Get my records error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/training-records", isAuthenticated, async (req, res) => {
    try {
      const { materialId, materialType, materialTitle } = req.body;
      const user = (req as any).user;

      if (!materialId || !materialType || !materialTitle) {
        return res.status(400).json({ message: "필수 정보가 누락되었습니다" });
      }

      const record = await storage.createTrainingRecord({
        guardId: user.id,
        materialId,
        materialType,
        materialTitle,
      });

      // 이수 완료 시 해당 자료의 알림 삭제
      await storage.deleteNotificationByMaterialAndGuard(materialId, user.id);

      return res.json(record);
    } catch (error) {
      console.error("Create record error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;

      const notificationsList = await storage.getNotificationsByGuard(user.id);
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
      await storage.markNotificationAsRead(req.params.id as string);
      return res.json({ message: "읽음 처리 완료" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  // 알림 삭제 (클릭 시) - 본인 알림만 삭제 가능
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;

      await storage.deleteNotificationIfOwner(req.params.id as string, user.id);
      return res.json({ message: "알림 삭제 완료" });
    } catch (error) {
      console.error("Delete notification error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;

      await storage.markAllNotificationsAsRead(user.id);
      return res.json({ message: "모두 읽음 처리 완료" });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });
  app.get("/api/dashboard/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const stats = await storage.getTrainingStats();
      return res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      return res.status(500).json({ message: "서버 오류" });
    }
  });


  app.post("/api/upload/signed-url", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { bucket = "uploads", fileType } = req.body;
      const fileExt = fileType ? `.${fileType.split("/")[1]}` : "";
      const fileName = `${crypto.randomUUID()}${fileExt}`;
      const filePath = `public/${fileName}`;

      const adminSupabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      // Create Signed Upload URL
      const { data, error } = await adminSupabase.storage
        .from(bucket)
        .createSignedUploadUrl(filePath);

      if (error) {
        throw error;
      }

      // Get Public URL for after upload
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return res.json({
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path, // This is the path needed for the upload
        publicUrl: publicData.publicUrl,
        fullPath: filePath // Return this ensuring we know where it went
      });
    } catch (error) {
      console.error("Signed URL error:", error);
      return res.status(500).json({ message: "서버 오류: " + (error as Error).message });
    }
  });

  app.post("/api/uploads", isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
    try {
      // Re-initialize a fresh client to ensure no global state issues
      // The test script proves this key works for uploads.
      const adminSupabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const file = req.file;
      const fileExt = file.originalname.split('.').pop() || 'bin';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // Ensure 'uploads' bucket exists
      try {
        const { data: buckets } = await adminSupabase.storage.listBuckets();
        const uploadBucketExists = buckets?.find(b => b.name === 'uploads');

        if (!uploadBucketExists) {
          await adminSupabase.storage.createBucket('uploads', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/*', 'application/pdf', 'audio/*', 'video/*'],
          });
        } else {
          // Update allowed mime types if bucket exists
          await adminSupabase.storage.updateBucket('uploads', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: ['image/*', 'application/pdf', 'audio/*', 'video/*'],
          });
        }
      } catch (err) {
        console.error("Bucket check error (ignored):", err);
      }

      // Upload file to Supabase using Service Role (Admin)
      const { data, error } = await adminSupabase.storage
        .from('uploads')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ message: "파일 업로드 실패 (" + error.message + ")" });
      }

      // Get Public URL
      const { data: publicData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return res.json({
        objectPath: publicData.publicUrl,
        fileName: fileName
      });

    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "서버 오류: " + (error as Error).message });
    }
  });

  // Excel Bulk Import
  app.post("/api/import/excel", upload.single("file"), isAuthenticated, async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "파일이 없습니다." });
    }

    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const stats = { sitesCreated: 0, guardsCreated: 0, guardsUpdated: 0, errors: 0 };

      console.log(`[Excel Import] File size: ${req.file.size} bytes`);
      console.log(`[Excel Import] Sheets found: ${workbook.SheetNames.join(", ")}`);

      // Cache existing data to minimize DB queries
      const existingSites = await storage.getSites();
      // Normalize existing site names for comparison
      const siteMap = new Map(existingSites.map(s => [s.name.trim(), s]));

      const existingGuards = await storage.getGuards();
      const guardMap = new Map(existingGuards.map(g => [g.phone, g])); // Map by phone

      for (const sheetName of workbook.SheetNames) {
        // Determine company from sheet name
        let company: "mirae_abm" | "dawon_pmc" | null = null;
        const lowerSheetName = sheetName.toLowerCase().replace(/\s/g, "");

        if (lowerSheetName.includes("미래") || lowerSheetName.includes("mirae")) {
          company = "mirae_abm";
        } else if (lowerSheetName.includes("다원") || lowerSheetName.includes("dawon")) {
          company = "dawon_pmc";
        }

        if (!company) {
          console.log(`[Excel Import] Skipping sheet "${sheetName}" - unknown company`);
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        // 1. Find Header Row dynamically
        // Convert to array of arrays to find the header row index
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        let headerRowIndex = -1;

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          // Check if row contains expected headers
          const rowStr = JSON.stringify(row);
          if (rowStr.includes("현장") && rowStr.includes("성명")) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          console.log(`[Excel Import] Could not find header row in sheet "${sheetName}".`);
          continue;
        }

        console.log(`[Excel Import] Found headers at row ${headerRowIndex + 1} in sheet "${sheetName}".`);

        // 2. Parse data starting from header row
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { range: headerRowIndex });

        for (const row of rows) {
          try {
            // Normalize keys: remove whitespace from keys
            const normalizedRow: any = {};
            for (const key in row) {
              normalizedRow[key.trim()] = row[key];
            }

            // Expected Headers: 현장, 성명, 연락처
            // Normalize input site name
            const rawSiteName = normalizedRow["현장"];
            const siteName = rawSiteName ? String(rawSiteName).trim() : null;

            const name = normalizedRow["성명"];
            const phone = normalizedRow["연락처"];

            if (!siteName || !name || !phone) {
              // console.log(`[Excel Import] Skipping row with missing fields:`, JSON.stringify(row));
              continue;
            }

            // 1. Upsert Site
            let site = siteMap.get(siteName);
            if (!site) {
              site = await storage.createSite({
                name: siteName,
                company: company,
                address: "", // Optional
              });
              siteMap.set(siteName, site);
              stats.sitesCreated++;
            }

            // 2. Upsert Guard
            // Clean phone number
            const cleanPhone = String(phone).trim().replace(/-/g, ""); // Remove dashes for storage consistency if needed, but current DB seems to use dashes.
            // Actually, let's keep the format consistent with input if standard is 010-1234-5678.
            // But usually nice to normalize. Let's stick to input for now or minimal trim.
            const formattedPhone = String(phone).trim();

            let guard = guardMap.get(formattedPhone);
            if (guard) {
              // Update existing guard
              // Only update if site changed or name changed? Just update always.
              await storage.updateUser(guard.id, {
                name: name,
                siteId: site.id,
                company: company,
                // We don't update password for existing users to avoid locking them out
              });
              stats.guardsUpdated++;
            } else {
              // Create new guard
              // Password = last 4 digits of phone
              const password = formattedPhone.slice(-4) || "0000";
              const username = formattedPhone; // Use phone as username

              // Check conflict again just in case
              const conflictingUser = await storage.getUserByUsername(username);
              if (conflictingUser) {
                // If exists but not in our guardMap (maybe admin or different role?), skip or update?
                // Let's safe update
                await storage.updateUser(conflictingUser.id, {
                  name: name,
                  siteId: site.id,
                  company: company,
                });
                stats.guardsUpdated++;
              } else {
                await storage.createUser({
                  username,
                  password,
                  name,
                  phone: formattedPhone,
                  role: "guard",
                  siteId: site.id,
                  company: company,
                });
                stats.guardsCreated++;
              }
            }

          } catch (rowError) {
            console.error("Error processing row:", rowError);
            stats.errors++;
          }
        }
      }

      console.log(`[Excel Import] Done. Stats:`, stats);
      res.json({ message: "일괄 등록 완료", stats });
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ message: "엑셀 처리 중 오류가 발생했습니다." });
    }
  });

  return httpServer;
}
