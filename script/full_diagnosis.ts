/**
 * full_diagnosis.ts
 * 사용자 로그인 실패 원인 전수 진단
 */
import "dotenv/config";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log("========================================");
  console.log("  STEP 1: DB 테이블 및 Enum 상태 확인");
  console.log("========================================\n");

  // 1-1. 실제 enum 값 확인
  const enums = await client.query(`
    SELECT typname, enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    ORDER BY typname, enumsortorder;
  `);
  const grouped: Record<string, string[]> = {};
  for (const row of enums.rows) {
    if (!grouped[row.typname]) grouped[row.typname] = [];
    grouped[row.typname].push(row.enumlabel);
  }
  console.log("DB Enum 현황:");
  for (const [type, values] of Object.entries(grouped)) {
    console.log(`  ${type}: [${values.join(", ")}]`);
  }

  // 1-2. users 테이블 컬럼 확인
  const cols = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log("\nusers 테이블 컬럼:");
  cols.rows.forEach((r: any) =>
    console.log(`  - ${r.column_name}: ${r.data_type}(${r.udt_name}) nullable=${r.is_nullable}`)
  );

  console.log("\n========================================");
  console.log("  STEP 2: DB에서 직접 guard 조회 테스트");
  console.log("========================================\n");

  // 2-1. 직접 SQL로 guard 조회 (Drizzle 우회)
  try {
    const rawGuards = await client.query(
      "SELECT id, name, phone, role, username FROM users WHERE role = 'guard' LIMIT 5"
    );
    console.log(`직접 SQL guard 조회 성공: ${rawGuards.rowCount}건`);
    rawGuards.rows.forEach((r: any) =>
      console.log(`  [${r.role}] ${r.name} | ${r.phone} | id=${r.id}`)
    );
  } catch (e: any) {
    console.error("❌ 직접 SQL guard 조회 실패:", e.message);
  }

  // 2-2. 이름으로 조회 (로그인 시 실제 사용되는 쿼리)
  const testName = (await client.query("SELECT name FROM users WHERE role='guard' LIMIT 1")).rows[0]?.name;
  if (testName) {
    try {
      const byName = await client.query(
        "SELECT id, name, phone, role FROM users WHERE name = $1",
        [testName]
      );
      console.log(`\n이름(${testName})으로 조회 성공: ${byName.rowCount}건`);
    } catch (e: any) {
      console.error(`❌ 이름 조회 실패:`, e.message);
    }
  }

  console.log("\n========================================");
  console.log("  STEP 3: role enum 값 가진 실제 데이터 확인");
  console.log("========================================\n");

  // 3. role 값 분포 확인
  const roleDist = await client.query(
    "SELECT role::text, COUNT(*) FROM users GROUP BY role::text"
  );
  console.log("role 값 분포:");
  roleDist.rows.forEach((r: any) => console.log(`  ${r.role}: ${r.count}명`));

  console.log("\n========================================");
  console.log("  STEP 4: Supabase Auth vs DB UUID 비교");
  console.log("========================================\n");

  // 4-1. Auth 사용자 목록
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
  console.log(`Auth 계정 수: ${allAuthUsers.length}`);

  // 4-2. UUID 일치 여부 확인
  const dbGuards = await client.query(
    "SELECT id, name, phone FROM users WHERE role = 'guard'"
  );
  let matchOk = 0, mismatch = 0, noAuth = 0;
  const mismatchSamples: any[] = [];

  for (const g of dbGuards.rows) {
    if (!g.phone) continue;
    const email = `${g.phone}@example.com`;
    const authUser = authByEmail.get(email);
    if (!authUser) {
      noAuth++;
    } else if (authUser.id !== g.id) {
      mismatch++;
      if (mismatchSamples.length < 3) {
        mismatchSamples.push({ name: g.name, dbId: g.id, authId: authUser.id });
      }
    } else {
      matchOk++;
    }
  }
  console.log(`UUID 완벽 일치: ${matchOk}명`);
  console.log(`UUID 불일치: ${mismatch}명`);
  console.log(`Auth 계정 없음: ${noAuth}명`);
  if (mismatchSamples.length > 0) {
    console.log("불일치 샘플:");
    mismatchSamples.forEach(s =>
      console.log(`  ${s.name}: DB=${s.dbId} | Auth=${s.authId}`)
    );
  }

  console.log("\n========================================");
  console.log("  STEP 5: 실제 로그인 API 흐름 시뮬레이션");
  console.log("========================================\n");

  // 5. 실제 경비원으로 로그인 시뮬레이션
  const sampleGuard = dbGuards.rows.find((r: any) => r.phone);
  if (sampleGuard) {
    const email = `${sampleGuard.phone}@example.com`;
    const password = sampleGuard.phone.replace(/-/g, "").slice(-4);

    console.log(`테스트 사용자: ${sampleGuard.name}`);
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);

    // Auth 로그인 시도
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.log(`  ❌ Auth 로그인 실패: ${signInError.message}`);
    } else {
      console.log(`  ✅ Auth 로그인 성공! auth_id=${signInData.user?.id}`);

      // DB에서 해당 UUID로 프로필 조회
      const profileCheck = await client.query(
        "SELECT id, name, role FROM users WHERE id = $1",
        [signInData.user?.id]
      );
      if (profileCheck.rowCount === 0) {
        console.log(`  ❌ DB 프로필 없음! (Auth UUID로 users 조회 실패)`);
      } else {
        console.log(`  ✅ DB 프로필 조회 성공: ${JSON.stringify(profileCheck.rows[0])}`);
      }
    }
  }

  console.log("\n========================================");
  console.log("  STEP 6: 배포 환경 변수 확인");
  console.log("========================================\n");
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  console.log(`DATABASE_URL (앞 60자): ${process.env.DATABASE_URL?.substring(0, 60)}...`);

  await client.end();
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
