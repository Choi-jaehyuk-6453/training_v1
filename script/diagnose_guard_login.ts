/**
 * 경비원 로그인 진단 스크립트
 * - DB에서 guard 유저 샘플 조회
 * - Supabase Auth에 해당 email/password 계정이 있는지 확인
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

async function run() {
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. guard role 사용자 샘플 10명 조회
  const guards = await dbClient.query(
    "SELECT id, name, username, phone, role FROM users WHERE role = 'guard' LIMIT 10"
  );

  console.log("=== DB의 guard 사용자 샘플 ===");
  guards.rows.forEach((r: any) => {
    const email = r.phone ? `${r.phone}@example.com` : "(phone 없음)";
    console.log(`  [${r.role}] ${r.name} (${r.username}) | phone: ${r.phone} | email: ${email}`);
  });

  // 2. phone이 없는 guard 수
  const noPhone = await dbClient.query(
    "SELECT COUNT(*) FROM users WHERE role = 'guard' AND (phone IS NULL OR phone = '')"
  );
  console.log(`\n⚠️  phone 없는 guard 수: ${noPhone.rows[0].count}명`);

  // 3. 첫 번째 guard로 Supabase Auth 로그인 테스트
  const sample = guards.rows.find((r: any) => r.phone);
  if (sample) {
    const email = `${sample.phone}@example.com`;
    const password = sample.phone.slice(-4);
    console.log(`\n=== Auth 로그인 테스트 ===`);
    console.log(`  사용자: ${sample.name}`);
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log(`  ❌ 로그인 실패: ${error.message}`);

      // Auth에 해당 이메일 계정이 있는지 확인
      const { data: listData } = await supabase.auth.admin.listUsers();
      const authUser = listData?.users?.find(u => u.email === email);
      if (authUser) {
        console.log(`  📋 Auth 계정 존재: ID=${authUser.id}, 생성일=${authUser.created_at}`);
        console.log(`      → Auth 계정은 있지만 비밀번호가 다름 (Attendance_site 비밀번호 가능)`);
      } else {
        console.log(`  📋 Auth 계정 없음 → Auth 계정 생성이 안 된 것`);
      }
    } else {
      console.log(`  ✅ 로그인 성공! user.id=${data.user?.id}`);
      // DB의 public.users.id와 비교
      if (data.user?.id !== sample.id) {
        console.log(`  ⚠️  Auth UUID(${data.user?.id}) ≠ DB UUID(${sample.id}) → ID 불일치`);
      } else {
        console.log(`  ✅ Auth UUID = DB UUID → 완벽 일치`);
      }
    }
  }

  await dbClient.end();
}

run().catch(console.error);
