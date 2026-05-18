import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 모든 enum 타입과 값 확인
  const r = await client.query(`
    SELECT typname, enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    ORDER BY typname, enumsortorder;
  `);

  console.log("=== mirae_sec_v1 DB Enum 목록 ===");
  const grouped: Record<string, string[]> = {};
  for (const row of r.rows) {
    if (!grouped[row.typname]) grouped[row.typname] = [];
    grouped[row.typname].push(row.enumlabel);
  }
  for (const [type, values] of Object.entries(grouped)) {
    console.log(`  ${type}: [${values.join(", ")}]`);
  }

  // company enum 체크 및 필요한 값 추가
  const companyValues = grouped["company"] || [];
  console.log("\n=== company enum 처리 ===");
  for (const val of ["mirae_abm", "dawon_pmc"]) {
    if (!companyValues.includes(val)) {
      console.log(`'${val}' 없음 → 추가 중...`);
      await client.query(`ALTER TYPE company ADD VALUE IF NOT EXISTS '${val}';`);
      console.log(`✅ '${val}' 추가 완료`);
    } else {
      console.log(`✅ '${val}' 이미 존재`);
    }
  }

  await client.end();
}

run().catch(console.error);
