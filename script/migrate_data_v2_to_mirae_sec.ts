/**
 * Phase 3 (개선): training_v1 DB → mirae_sec_v1 DB 데이터 이전 스크립트 (UUID 매핑 포함)
 *
 * 문제: training_v1의 users.id(UUID)와 mirae_sec_v1의 users.id가 달라
 *       training_records/notifications의 guard_id FK 연결이 끊어짐.
 *
 * 해결: username 기반으로 old_id → new_id 매핑을 구축 후 FK 컬럼 번환하여 삽입.
 *
 * 실행 방법:
 *   OLD_DB_URL=<training_v1 URL>
 *   NEW_DB_URL=<mirae_sec_v1 URL>
 *   npx tsx script/migrate_data_v2_to_mirae_sec.ts
 */

import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

const OLD_DB_URL = process.env.OLD_DB_URL;
const NEW_DB_URL = process.env.NEW_DB_URL;

if (!OLD_DB_URL || !NEW_DB_URL) {
  console.error("❌ OLD_DB_URL 또는 NEW_DB_URL 환경변수가 없습니다.");
  process.exit(1);
}

async function run() {
  const oldClient = new Client({ connectionString: OLD_DB_URL });
  const newClient = new Client({ connectionString: NEW_DB_URL });

  await oldClient.connect();
  console.log("✅ 기존 DB(training_v1) 연결 성공");
  await newClient.connect();
  console.log("✅ 신규 DB(mirae_sec_v1) 연결 성공\n");

  // UUID 매핑 테이블
  const userIdMap: Record<string, string> = {};   // old_user_id → new_user_id
  const siteIdMap: Record<string, string> = {};   // old_site_id → new_site_id
  const materialIdMap: Record<string, string> = {}; // old_mat_id → new_mat_id

  try {
    // ─────────────────────────────────────────────
    // 1. sites 이전 + ID 매핑
    // ─────────────────────────────────────────────
    console.log("[1/5] sites 이전 + ID 매핑 구축 중...");
    const sitesRes = await oldClient.query("SELECT * FROM sites ORDER BY created_at ASC");
    let sitesInserted = 0, sitesSkipped = 0;

    for (const row of sitesRes.rows) {
      // 신규 DB에서 같은 이름의 site 검색
      const existing = await newClient.query("SELECT id FROM sites WHERE name = $1 LIMIT 1", [row.name]);

      if (existing.rows.length > 0) {
        // 이미 존재 → UUID 매핑만 추가
        siteIdMap[row.id] = existing.rows[0].id;
        sitesSkipped++;
      } else {
        // 없으면 원래 ID 그대로 삽입
        try {
          await newClient.query(`
            INSERT INTO sites (id, name, company, address, created_at)
            VALUES ($1, $2, $3, $4, $5)
          `, [row.id, row.name, row.company, row.address, row.created_at]);
          siteIdMap[row.id] = row.id;
          sitesInserted++;
        } catch (e: any) {
          console.log(`   ⚠️  site 삽입 실패 (${row.name}): ${e.message}`);
        }
      }
    }
    console.log(`   ✅ sites: ${sitesInserted}개 삽입, ${sitesSkipped}개 기존 매핑`);
    console.log(`   📋 site ID 매핑: ${Object.keys(siteIdMap).length}개\n`);

    // ─────────────────────────────────────────────
    // 2. users 이전 + ID 매핑
    // ─────────────────────────────────────────────
    console.log("[2/5] users 이전 + ID 매핑 구축 중...");
    const usersRes = await oldClient.query("SELECT * FROM users ORDER BY created_at ASC");
    let usersInserted = 0, usersSkipped = 0;

    for (const row of usersRes.rows) {
      // username 기반으로 신규 DB에서 기존 user 검색
      const existing = await newClient.query("SELECT id FROM users WHERE username = $1 LIMIT 1", [row.username]);

      if (existing.rows.length > 0) {
        // 이미 존재 → UUID 매핑 추가 (비밀번호 등 최신 정보로 업데이트)
        const newId = existing.rows[0].id;
        userIdMap[row.id] = newId;

        // 비밀번호, 이름, 전화번호를 training_v1 값으로 업데이트
        await newClient.query(`
          UPDATE users SET
            password = $1,
            name = $2,
            phone = $3,
            company = $4::company,
            site_id = $5,
            created_at = COALESCE(created_at, $6)
          WHERE id = $7
        `, [row.password, row.name, row.phone,
            row.company, siteIdMap[row.site_id] || row.site_id,
            row.created_at, newId]);

        usersSkipped++;
      } else {
        // 없으면 원래 ID 그대로 삽입
        try {
          const mappedSiteId = row.site_id ? (siteIdMap[row.site_id] || row.site_id) : null;
          await newClient.query(`
            INSERT INTO users (id, username, password, name, phone, role, company, site_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::role, $7::company, $8, $9)
          `, [row.id, row.username, row.password, row.name, row.phone,
              row.role, row.company, mappedSiteId, row.created_at]);
          userIdMap[row.id] = row.id;
          usersInserted++;
        } catch (e: any) {
          console.log(`   ⚠️  user 삽입 실패 (${row.username}): ${e.message}`);
        }
      }
    }
    console.log(`   ✅ users: ${usersInserted}개 삽입, ${usersSkipped}개 기존 매핑`);
    console.log(`   📋 user ID 매핑: ${Object.keys(userIdMap).length}개\n`);

    // ─────────────────────────────────────────────
    // 3. training_materials 이전 + ID 매핑
    // ─────────────────────────────────────────────
    console.log("[3/5] training_materials 이전 중...");
    const materialsRes = await oldClient.query("SELECT * FROM training_materials ORDER BY created_at ASC");
    let matInserted = 0, matSkipped = 0;

    for (const row of materialsRes.rows) {
      // title + month 로 중복 체크
      const existing = await newClient.query(
        "SELECT id FROM training_materials WHERE title = $1 AND month = $2 LIMIT 1",
        [row.title, row.month]
      );

      if (existing.rows.length > 0) {
        materialIdMap[row.id] = existing.rows[0].id;
        matSkipped++;
      } else {
        try {
          await newClient.query(`
            INSERT INTO training_materials
              (id, title, description, type, video_url, video_urls, card_images, audio_urls, quizzes, month, created_at, updated_at)
            VALUES ($1, $2, $3, $4::material_type, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [row.id, row.title, row.description, row.type, row.video_url,
              row.video_urls, row.card_images, row.audio_urls,
              row.quizzes ? JSON.stringify(row.quizzes) : null,
              row.month, row.created_at, row.updated_at]);
          materialIdMap[row.id] = row.id;
          matInserted++;
        } catch (e: any) {
          console.log(`   ⚠️  material 삽입 실패 (${row.title}): ${e.message}`);
        }
      }
    }
    console.log(`   ✅ training_materials: ${matInserted}개 삽입, ${matSkipped}개 기존 매핑\n`);

    // ─────────────────────────────────────────────
    // 4. training_records 이전 (UUID 매핑 적용)
    // ─────────────────────────────────────────────
    console.log("[4/5] training_records 이전 (UUID 변환 적용)...");
    const recordsRes = await oldClient.query("SELECT * FROM training_records ORDER BY completed_at ASC");
    let recInserted = 0, recSkipped = 0, recNoMap = 0;

    for (const row of recordsRes.rows) {
      const newGuardId = userIdMap[row.guard_id];
      const newMaterialId = materialIdMap[row.material_id] || row.material_id;

      if (!newGuardId) {
        recNoMap++;
        continue; // 매핑 없는 사용자는 skip
      }

      try {
        await newClient.query(`
          INSERT INTO training_records
            (id, guard_id, material_id, completed_at, material_type, material_title, score, passed)
          VALUES ($1, $2, $3, $4, $5::material_type, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, newGuardId, newMaterialId, row.completed_at,
            row.material_type, row.material_title, row.score, row.passed]);
        recInserted++;
      } catch (e: any) {
        console.log(`   ⚠️  record 실패: ${e.message}`);
        recSkipped++;
      }
    }
    console.log(`   ✅ training_records: ${recInserted}개 삽입, ${recSkipped}개 실패, ${recNoMap}개 매핑 없음\n`);

    // ─────────────────────────────────────────────
    // 5. notifications 이전 (UUID 매핑 적용)
    // ─────────────────────────────────────────────
    console.log("[5/5] notifications 이전 (UUID 변환 적용)...");
    const notifRes = await oldClient.query("SELECT * FROM notifications ORDER BY created_at ASC");
    let notifInserted = 0, notifSkipped = 0, notifNoMap = 0;

    for (const row of notifRes.rows) {
      const newGuardId = userIdMap[row.guard_id];
      const newMaterialId = materialIdMap[row.material_id] || row.material_id;

      if (!newGuardId) {
        notifNoMap++;
        continue;
      }

      try {
        await newClient.query(`
          INSERT INTO notifications (id, guard_id, material_id, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [row.id, newGuardId, newMaterialId, row.is_read, row.created_at]);
        notifInserted++;
      } catch (e: any) {
        notifSkipped++;
      }
    }
    console.log(`   ✅ notifications: ${notifInserted}개 삽입, ${notifSkipped}개 실패, ${notifNoMap}개 매핑 없음\n`);

    // ─────────────────────────────────────────────
    // 완료 요약
    // ─────────────────────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("🎉 데이터 이전 완료!");
    console.log("   users 매핑:", Object.keys(userIdMap).length, "개");
    console.log("   sites 매핑:", Object.keys(siteIdMap).length, "개");
    console.log("   materials 매핑:", Object.keys(materialIdMap).length, "개");
    console.log("═══════════════════════════════════════");
    console.log("   ▶ 다음 단계: .env 파일 업데이트 후 npm run dev 로 검증");

  } catch (err) {
    console.error("❌ 치명적 오류:", err);
    process.exit(1);
  } finally {
    await oldClient.end();
    await newClient.end();
  }
}

run();
