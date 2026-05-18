import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 현재 role enum 값 확인
  const enumCheck = await client.query(`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'role'
    ORDER BY enumsortorder;
  `);
  console.log("현재 role enum 값:", enumCheck.rows.map((r: any) => r.enumlabel));

  // 'guard' 값이 없으면 추가
  const hasGuard = enumCheck.rows.some((r: any) => r.enumlabel === "guard");
  const hasAdmin = enumCheck.rows.some((r: any) => r.enumlabel === "admin");

  if (!hasGuard) {
    console.log("'guard' 값 없음 → 추가 중...");
    await client.query(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'guard';`);
    console.log("✅ 'guard' 추가 완료");
  } else {
    console.log("✅ 'guard' 이미 존재");
  }

  if (!hasAdmin) {
    console.log("'admin' 값 없음 → 추가 중...");
    await client.query(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'admin';`);
    console.log("✅ 'admin' 추가 완료");
  }

  // 추가 후 최종 확인
  const finalCheck = await client.query(`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'role'
    ORDER BY enumsortorder;
  `);
  console.log("최종 role enum 값:", finalCheck.rows.map((r: any) => r.enumlabel));

  await client.end();
}

run().catch(console.error);
