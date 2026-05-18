/**
 * Phase 2: mirae_sec_v1 DB에 training_v1 전용 테이블 생성 스크립트
 *
 * 실행: DATABASE_URL=<mirae_sec_v1 URL> npx tsx script/migrate_schema_to_mirae_sec.ts
 *
 * 수행 작업:
 * 1. users 테이블에 created_at 컬럼 추가 (없으면)
 * 2. sites 테이블에 created_at 컬럼 추가 (없으면)
 * 3. material_type enum 생성
 * 4. training_materials 테이블 생성
 * 5. training_records 테이블 생성
 * 6. notifications 테이블 생성
 */

import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("✅ DB 연결 성공:", DATABASE_URL!.split("@")[1]);

  try {
    // ─────────────────────────────────────────────
    // 1. users 테이블에 created_at 컬럼 추가
    // ─────────────────────────────────────────────
    console.log("\n[1/6] users 테이블에 created_at 컬럼 추가 중...");
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);
    console.log("   ✅ 완료");

    // ─────────────────────────────────────────────
    // 2. sites 테이블에 created_at 컬럼 추가
    // ─────────────────────────────────────────────
    console.log("\n[2/6] sites 테이블에 created_at 컬럼 추가 중...");
    await client.query(`
      ALTER TABLE sites
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);
    console.log("   ✅ 완료");

    // ─────────────────────────────────────────────
    // 3. material_type enum 생성
    // ─────────────────────────────────────────────
    console.log("\n[3/6] material_type enum 생성 중...");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE material_type AS ENUM ('card', 'video');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log("   ✅ 완료 (이미 있으면 skip)");

    // ─────────────────────────────────────────────
    // 4. training_materials 테이블 생성
    // ─────────────────────────────────────────────
    console.log("\n[4/6] training_materials 테이블 생성 중...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_materials (
        id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title      TEXT NOT NULL,
        description TEXT,
        type       material_type NOT NULL,
        video_url  TEXT,
        video_urls TEXT[],
        card_images TEXT[],
        audio_urls TEXT[],
        quizzes    JSONB,
        month      TEXT NOT NULL DEFAULT '수시',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("   ✅ 완료");

    // ─────────────────────────────────────────────
    // 5. training_records 테이블 생성
    // ─────────────────────────────────────────────
    console.log("\n[5/6] training_records 테이블 생성 중...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_records (
        id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        guard_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        material_id    VARCHAR NOT NULL REFERENCES training_materials(id) ON DELETE CASCADE,
        completed_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        material_type  material_type NOT NULL,
        material_title TEXT NOT NULL,
        score          INTEGER,
        passed         BOOLEAN DEFAULT false
      );
    `);
    console.log("   ✅ 완료");

    // ─────────────────────────────────────────────
    // 6. notifications 테이블 생성
    // ─────────────────────────────────────────────
    console.log("\n[6/6] notifications 테이블 생성 중...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        guard_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        material_id VARCHAR NOT NULL REFERENCES training_materials(id) ON DELETE CASCADE,
        is_read     BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("   ✅ 완료");

    console.log("\n🎉 스키마 마이그레이션 완료!");
    console.log("   다음 단계: script/migrate_data_to_mirae_sec.ts 실행");

  } catch (err) {
    console.error("❌ 오류 발생:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
