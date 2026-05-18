import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // users 테이블 실제 컬럼 확인
  const usersColumns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log("=== users 테이블 컬럼 ===");
  usersColumns.rows.forEach((r: any) => console.log(` - ${r.column_name}: ${r.data_type}`));

  // sites 테이블 실제 컬럼 확인
  const sitesColumns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sites'
    ORDER BY ordinal_position;
  `);
  console.log("\n=== sites 테이블 컬럼 ===");
  sitesColumns.rows.forEach((r: any) => console.log(` - ${r.column_name}: ${r.data_type}`));

  await client.end();
}

run().catch(console.error);
