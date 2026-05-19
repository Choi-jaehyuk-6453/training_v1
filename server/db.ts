import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                    // Supabase pgBouncer 트랜잭션 모드에 적합한 풀 크기
  idleTimeoutMillis: 30_000, // 30초 유휴 시 연결 반환
  connectionTimeoutMillis: 5_000, // 연결 대기 최대 5초
});
export const db = drizzle(pool, { schema });
