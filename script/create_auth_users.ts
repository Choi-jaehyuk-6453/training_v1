/**
 * mirae_sec_v1 Supabase Auth 계정 생성 스크립트
 *
 * training_v1의 public.users 에는 데이터가 있지만,
 * Supabase Auth(auth.users)는 프로젝트 간 이전이 불가하여
 * mirae_sec_v1에 Auth 계정을 새로 생성합니다.
 *
 * - 관리자: email = admin@example.com, password = admin1234
 * - 경비원: email = ${phone}@example.com, password = 전화번호 뒷 4자리
 *
 * 실행: DATABASE_URL=<mirae_sec_v1 URL> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key>
 *       npx tsx script/create_auth_users.ts
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ 필요한 환경변수가 없습니다.");
  console.error("   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function run() {
  const dbClient = new Client({ connectionString: DATABASE_URL });
  await dbClient.connect();
  console.log("✅ DB 연결 성공\n");

  // public.users 전체 조회
  const usersRes = await dbClient.query("SELECT * FROM users ORDER BY created_at ASC NULLS LAST");
  const users = usersRes.rows;
  console.log(`📋 총 ${users.length}명의 사용자 Auth 계정 생성 시작\n`);

  // 기존 Auth 사용자 목록 가져오기 (이미 있는 계정 skip 처리)
  const existingAuthMap: Record<string, string> = {}; // id → email
  const existingEmailMap: Record<string, string> = {}; // email → id
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      existingAuthMap[u.id] = u.email || "";
      if (u.email) existingEmailMap[u.email] = u.id;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  console.log(`🔍 기존 Auth 계정: ${Object.keys(existingAuthMap).length}개\n`);

  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (const user of users) {
    // 이메일 & 비밀번호 결정
    let email: string;
    let password: string;

    const isAdmin = user.username === "관리자" || user.username === "admin";

    if (isAdmin) {
      email = "admin@example.com";
      password = "admin1234"; // 기본 관리자 비밀번호
    } else {
      if (!user.phone) {
        console.log(`   ⚠️  전화번호 없어 skip: ${user.name} (${user.username})`);
        skipped++;
        continue;
      }
      email = `${user.phone}@example.com`;
      password = user.phone.slice(-4) || "0000";
    }

    // 이미 동일 ID로 Auth 계정이 있는 경우
    if (existingAuthMap[user.id]) {
      // 이메일이 다르면 업데이트
      if (existingAuthMap[user.id] !== email) {
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          email,
          password,
          email_confirm: true,
        });
        if (error) {
          console.log(`   ⚠️  업데이트 실패 (${user.name}): ${error.message}`);
          failed++;
        } else {
          updated++;
        }
      } else {
        skipped++; // 이미 동일한 계정
      }
      continue;
    }

    // 동일 이메일로 다른 ID의 Auth 계정이 있는 경우
    if (existingEmailMap[email]) {
      // 기존 계정 삭제 후 재생성 (ID 맞추기 위해)
      await supabase.auth.admin.deleteUser(existingEmailMap[email]);
    }

    // 새 Auth 계정 생성 (public.users 와 동일한 UUID 사용)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: user.role, name: user.name },
    });

    if (error) {
      console.log(`   ❌ 생성 실패 (${user.name} / ${email}): ${error.message}`);
      failed++;
    } else {
      // Auth에서 생성된 UUID가 public.users.id와 다를 수 있으므로 public.users 업데이트
      if (data.user && data.user.id !== user.id) {
        try {
          await dbClient.query(
            "UPDATE users SET id = $1 WHERE id = $2",
            [data.user.id, user.id]
          );
          // training_records / notifications도 업데이트
          await dbClient.query(
            "UPDATE training_records SET guard_id = $1 WHERE guard_id = $2",
            [data.user.id, user.id]
          );
          await dbClient.query(
            "UPDATE notifications SET guard_id = $1 WHERE guard_id = $2",
            [data.user.id, user.id]
          );
        } catch (e: any) {
          console.log(`   ⚠️  ID 동기화 실패 (${user.name}): ${e.message}`);
        }
      }
      created++;
    }
  }

  await dbClient.end();

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Auth 계정 생성 완료!");
  console.log(`   생성: ${created}개`);
  console.log(`   업데이트: ${updated}개`);
  console.log(`   skip: ${skipped}개`);
  console.log(`   실패: ${failed}개`);
  console.log("═══════════════════════════════════════");
  console.log("   관리자 로그인: username=관리자, password=admin1234");
  console.log("   경비원 로그인: username=이름, password=전화번호 뒷 4자리");
}

run().catch(console.error);
