/**
 * fix_worker_uuid_mismatch.ts
 * ===========================
 * worker / site_manager / hq_admin 의 UUID 불일치 수정
 *
 * 문제: DB 이전 후 public.users.id(구 UUID) ≠ Supabase auth.users.id(현 UUID)
 * 해결:
 *   1. DB의 non-guard 사용자 조회
 *   2. phone@example.com 으로 Auth 계정 검색
 *   3. UUID 불일치 시 DB 레코드를 Auth UUID 로 교체
 *   4. Auth 비밀번호를 phone 뒷 4자리로 리셋 (훈련 시스템 로그인 규칙 통일)
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
  console.log("=== worker/site_manager/hq_admin UUID 불일치 수정 시작 ===\n");

  // 1. Auth 사용자 전체 목록
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

  // 2. DB의 non-guard 사용자 조회 (admin 제외)
  const { rows: users } = await pool.query(
    "SELECT id, name, phone, username, password, role, company, site_id, created_at FROM users WHERE role IN ('worker', 'site_manager', 'hq_admin')"
  );
  console.log(`DB worker/site_manager/hq_admin 총 ${users.length}명 조회 완료\n`);

  let matchOk = 0, fixedCount = 0, noPhone = 0, noAuth = 0, errorCount = 0;

  for (const user of users) {
    if (!user.phone) {
      console.log(`  ⚠️  [${user.name}] phone 없음 → 스킵`);
      noPhone++;
      continue;
    }

    const email = `${user.phone}@example.com`;
    const password = user.phone.replace(/-/g, "").slice(-4) || "0000";
    const authUser = authByEmail.get(email);

    if (!authUser) {
      console.log(`  📵 [${user.name}] Auth 계정 없음 → 스킵`);
      noAuth++;
      continue;
    }

    if (authUser.id === user.id) {
      // UUID 일치 → 비밀번호만 리셋 (훈련 시스템 규칙으로 통일)
      try {
        await supabase.auth.admin.updateUserById(authUser.id, { password });
        matchOk++;
      } catch (e: any) {
        console.error(`  ❌ [${user.name}] 비밀번호 리셋 실패: ${e.message}`);
        errorCount++;
      }
      continue;
    }

    // UUID 불일치 → DB UUID를 Auth UUID로 교체 + 비밀번호 리셋
    console.log(`  🔧 [${user.name}] UUID 불일치 → 교체 중... (${user.id} → ${authUser.id})`);
    try {
      await migrateDbId(user, authUser.id);
      // 비밀번호를 phone 뒷 4자리로 리셋
      await supabase.auth.admin.updateUserById(authUser.id, { password });
      console.log(`  ✅ [${user.name}] UUID 교체 + 비밀번호 리셋 완료`);
      fixedCount++;
    } catch (e: any) {
      console.error(`  ❌ [${user.name}] 수정 실패: ${e.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== 수정 완료 ===`);
  console.log(`  ✅ UUID 일치 (비밀번호만 리셋): ${matchOk}명`);
  console.log(`  🔧 UUID 교체 + 비밀번호 리셋:   ${fixedCount}명`);
  console.log(`  📵 Auth 계정 없음:              ${noAuth}명`);
  console.log(`  ⚠️  phone 없음:                 ${noPhone}명`);
  console.log(`  ❌ 오류:                        ${errorCount}명`);

  await pool.end();
  process.exit(0);
}

/**
 * DB의 user 레코드를 oldId → newId 로 교체
 * (notifications, training_records 외래키도 함께 업데이트)
 */
async function migrateDbId(user: any, newId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // unique constraint 우회를 위해 임시 username 설정
    const tempUsername = `${user.username}_migrating_${Date.now()}`;
    await client.query("UPDATE users SET username = $1 WHERE id = $2", [tempUsername, user.id]);

    // 새 UUID로 사용자 레코드 삽입 (is_active 기본값 true 설정)
    await client.query(
      `INSERT INTO users (id, username, password, name, phone, role, company, site_id, created_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO NOTHING`,
      [newId, user.username, user.password, user.name, user.phone, user.role, user.company, user.site_id, user.created_at]
    );

    // 연결된 자식 테이블 외래키 업데이트 (모든 FK 참조)
    await client.query("UPDATE notifications SET guard_id = $1 WHERE guard_id = $2", [newId, user.id]);
    await client.query("UPDATE training_records SET guard_id = $1 WHERE guard_id = $2", [newId, user.id]);
    await client.query("UPDATE attendance_logs SET user_id = $1 WHERE user_id = $2", [newId, user.id]);
    await client.query("UPDATE vacation_requests SET user_id = $1 WHERE user_id = $2", [newId, user.id]);
    await client.query("UPDATE vacation_requests SET responded_by = $1 WHERE responded_by = $2", [newId, user.id]);
    await client.query("UPDATE gems_profiles SET id = $1 WHERE id = $2", [newId, user.id]);

    // 구 레코드 삭제
    await client.query("DELETE FROM users WHERE id = $1", [user.id]);

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
