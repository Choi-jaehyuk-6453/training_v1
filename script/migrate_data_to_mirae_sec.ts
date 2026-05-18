/**
 * Phase 3: training_v1 DB → mirae_sec_v1 DB 데이터 이전 스크립트
 *
 * 실행 방법:
 *   OLD_DB_URL=<training_v1 DB URL>
 *   NEW_DB_URL=<mirae_sec_v1 DB URL>
 *   npx tsx script/migrate_data_to_mirae_sec.ts
 *
 * 이전 순서 (FK 의존성):
 *   1. sites
 *   2. users          (→ sites 참조)
 *   3. training_materials
 *   4. training_records  (→ users, training_materials 참조)
 *   5. notifications     (→ users, training_materials 참조)
 *
 * 중복 처리:
 *   - sites: id 중복 시 SKIP
 *   - users: username 중복 시 SKIP
 *   - training_materials/records/notifications: id 중복 시 SKIP
 */

import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const OLD_DB_URL = process.env.OLD_DB_URL;
const NEW_DB_URL = process.env.NEW_DB_URL;

if (!OLD_DB_URL || !NEW_DB_URL) {
  console.error("❌ OLD_DB_URL 또는 NEW_DB_URL 환경변수가 없습니다.");
  console.error("   사용법: OLD_DB_URL=<기존> NEW_DB_URL=<신규> npx tsx script/migrate_data_to_mirae_sec.ts");
  process.exit(1);
}

async function run() {
  const oldClient = new Client({ connectionString: OLD_DB_URL });
  const newClient = new Client({ connectionString: NEW_DB_URL });

  await oldClient.connect();
  console.log("✅ 기존 DB(training_v1) 연결 성공");
  await newClient.connect();
  console.log("✅ 신규 DB(mirae_sec_v1) 연결 성공");

  try {
    // ─────────────────────────────────────────────
    // 1. sites 이전
    // ─────────────────────────────────────────────
    console.log("\n[1/5] sites 데이터 이전 중...");
    const sitesRes = await oldClient.query("SELECT * FROM sites");
    let sitesInserted = 0, sitesSkipped = 0;

    for (const row of sitesRes.rows) {
      try {
        await newClient.query(`
          INSERT INTO sites (id, name, company, address, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, row.name, row.company, row.address, row.created_at]);
        sitesInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  site skip (${row.name}): ${e.message}`);
        sitesSkipped++;
      }
    }
    console.log(`   ✅ sites: ${sitesInserted}개 삽입, ${sitesSkipped}개 skip`);

    // ─────────────────────────────────────────────
    // 2. users 이전
    // ─────────────────────────────────────────────
    console.log("\n[2/5] users 데이터 이전 중...");
    const usersRes = await oldClient.query("SELECT * FROM users");
    let usersInserted = 0, usersSkipped = 0;

    for (const row of usersRes.rows) {
      try {
        await newClient.query(`
          INSERT INTO users (id, username, password, name, phone, role, company, site_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6::role, $7::company, $8, $9)
          ON CONFLICT (username) DO NOTHING
        `, [row.id, row.username, row.password, row.name, row.phone,
            row.role, row.company, row.site_id, row.created_at]);
        usersInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  user skip (${row.username}): ${e.message}`);
        usersSkipped++;
      }
    }
    console.log(`   ✅ users: ${usersInserted}개 삽입, ${usersSkipped}개 skip`);

    // ─────────────────────────────────────────────
    // 3. training_materials 이전
    // ─────────────────────────────────────────────
    console.log("\n[3/5] training_materials 데이터 이전 중...");
    const materialsRes = await oldClient.query("SELECT * FROM training_materials");
    let materialsInserted = 0, materialsSkipped = 0;

    for (const row of materialsRes.rows) {
      try {
        await newClient.query(`
          INSERT INTO training_materials
            (id, title, description, type, video_url, video_urls, card_images, audio_urls, quizzes, month, created_at, updated_at)
          VALUES ($1, $2, $3, $4::material_type, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, row.title, row.description, row.type, row.video_url,
            row.video_urls, row.card_images, row.audio_urls,
            row.quizzes ? JSON.stringify(row.quizzes) : null,
            row.month, row.created_at, row.updated_at]);
        materialsInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  material skip (${row.title}): ${e.message}`);
        materialsSkipped++;
      }
    }
    console.log(`   ✅ training_materials: ${materialsInserted}개 삽입, ${materialsSkipped}개 skip`);

    // ─────────────────────────────────────────────
    // 4. training_records 이전
    // ─────────────────────────────────────────────
    console.log("\n[4/5] training_records 데이터 이전 중...");
    const recordsRes = await oldClient.query("SELECT * FROM training_records");
    let recordsInserted = 0, recordsSkipped = 0;

    for (const row of recordsRes.rows) {
      try {
        await newClient.query(`
          INSERT INTO training_records
            (id, guard_id, material_id, completed_at, material_type, material_title, score, passed)
          VALUES ($1, $2, $3, $4, $5::material_type, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, row.guard_id, row.material_id, row.completed_at,
            row.material_type, row.material_title, row.score, row.passed]);
        recordsInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  record skip: ${e.message}`);
        recordsSkipped++;
      }
    }
    console.log(`   ✅ training_records: ${recordsInserted}개 삽입, ${recordsSkipped}개 skip`);

    // ─────────────────────────────────────────────
    // 5. notifications 이전
    // ─────────────────────────────────────────────
    console.log("\n[5/5] notifications 데이터 이전 중...");
    const notifRes = await oldClient.query("SELECT * FROM notifications");
    let notifInserted = 0, notifSkipped = 0;

    for (const row of notifRes.rows) {
      try {
        await newClient.query(`
          INSERT INTO notifications (id, guard_id, material_id, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, row.guard_id, row.material_id, row.is_read, row.created_at]);
        notifInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  notification skip: ${e.message}`);
        notifSkipped++;
      }
    }
    console.log(`   ✅ notifications: ${notifInserted}개 삽입, ${notifSkipped}개 skip`);

    // ─────────────────────────────────────────────
    // 완료 요약
    // ─────────────────────────────────────────────
    console.log("\n🎉 데이터 이전 완료!");
    console.log("   다음 단계: .env 파일을 mirae_sec_v1 설정으로 변경 후 npm run dev 로 검증");

  } catch (err) {
    console.error("❌ 오류 발생:", err);
    process.exit(1);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

run();
