/**
 * fix_uuid_mismatch.ts
 * =====================
 * 문제: Supabase 프로젝트 이전 후
 *   - Supabase Auth의 user.id (새 UUID)
 *   - public.users 테이블의 id (구 UUID)
 *   가 불일치하여 로그인 후 프로필을 찾지 못해 서버 오류 발생
 *
 * 해결:
 *   1. DB의 모든 guard를 조회
 *   2. Auth에서 phone@example.com 으로 해당 계정 찾기
 *   3. Auth UUID != DB UUID 이면 DB 레코드를 새 UUID로 교체
 *   4. Auth 계정 자체가 없으면 생성 후 DB 교체
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("=== UUID 불일치 수정 시작 ===\n");

  // 1. Auth 유저 전체 목록 가져오기
  let allAuthUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    allAuthUsers.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  const authByEmail = new Map(allAuthUsers.map(u => [u.email, u]));
  console.log(`Auth 계정 총 ${allAuthUsers.length}개 조회 완료\n`);

  // 2. DB의 guard 전원 조회
  const { rows: guards } = await pool.query(
    "SELECT id, name, phone, username, password, role, company, site_id, created_at FROM users WHERE role = 'guard'"
  );
  console.log(`DB guard 총 ${guards.length}명 조회 완료\n`);

  let fixedCount = 0;
  let createdCount = 0;
  let okCount = 0;
  let errorCount = 0;

  for (const guard of guards) {
    if (!guard.phone) {
      console.log(`  ⚠️  [${guard.name}] phone 없음 → 스킵`);
      errorCount++;
      continue;
    }

    const email = `${guard.phone}@example.com`;
    const password = guard.phone.replace(/-/g, "").slice(-4) || "0000";
    const authUser = authByEmail.get(email);

    if (!authUser) {
      // Auth 계정이 아예 없는 경우 → 생성 후 DB UUID 교체
      console.log(`  🔧 [${guard.name}] Auth 계정 없음 → 생성 중...`);

      const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: guard.role || "guard", name: guard.name },
      });

      if (createErr || !newAuth.user) {
        console.error(`  ❌ [${guard.name}] Auth 생성 실패: ${createErr?.message}`);
        errorCount++;
        continue;
      }

      const newId = newAuth.user.id;
      try {
        await migrateDbId(guard, newId);
        console.log(`  ✅ [${guard.name}] Auth 생성 + DB ID 교체 완료 (${guard.id} → ${newId})`);
        createdCount++;
      } catch (e: any) {
        console.error(`  ❌ [${guard.name}] DB ID 교체 실패: ${e.message}`);
        errorCount++;
      }

    } else if (authUser.id !== guard.id) {
      // Auth 계정은 있지만 UUID 불일치
      console.log(`  🔧 [${guard.name}] UUID 불일치 → DB ID 교체 중... (${guard.id} → ${authUser.id})`);
      try {
        await migrateDbId(guard, authUser.id);
        console.log(`  ✅ [${guard.name}] DB ID 교체 완료`);
        fixedCount++;
      } catch (e: any) {
        console.error(`  ❌ [${guard.name}] DB ID 교체 실패: ${e.message}`);
        errorCount++;
      }

    } else {
      // 완벽 일치
      okCount++;
      // console.log(`  ✅ [${guard.name}] 정상 (UUID 일치)`);
    }
  }

  console.log(`\n=== 수정 완료 ===`);
  console.log(`  ✅ 원래 정상:     ${okCount}명`);
  console.log(`  🔧 UUID 교체:     ${fixedCount}명`);
  console.log(`  🔧 Auth 생성+교체: ${createdCount}명`);
  console.log(`  ❌ 오류:          ${errorCount}명`);

  await pool.end();
  process.exit(0);
}

/**
 * DB의 guard 레코드를 oldId → newId 로 교체
 * (notifications, training_records 외래키도 같이 업데이트)
 */
async function migrateDbId(guard: any, newId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 기존 username을 임시 이름으로 변경 (unique constraint 우회)
    const tempUsername = `${guard.username}_migrating_${Date.now()}`;
    await client.query(
      "UPDATE users SET username = $1 WHERE id = $2",
      [tempUsername, guard.id]
    );

    // 새 UUID로 사용자 레코드 삽입
    await client.query(
      `INSERT INTO users (id, username, password, name, phone, role, company, site_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        newId,
        guard.username,
        guard.password,
        guard.name,
        guard.phone,
        guard.role,
        guard.company,
        guard.site_id,
        guard.created_at,
      ]
    );

    // 연결된 자식 테이블 외래키 업데이트
    await client.query(
      "UPDATE notifications SET guard_id = $1 WHERE guard_id = $2",
      [newId, guard.id]
    );
    await client.query(
      "UPDATE training_records SET guard_id = $1 WHERE guard_id = $2",
      [newId, guard.id]
    );

    // 구 레코드 삭제
    await client.query("DELETE FROM users WHERE id = $1", [guard.id]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
