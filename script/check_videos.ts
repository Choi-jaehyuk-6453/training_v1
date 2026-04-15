import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();
  const res = await client.query(
    'SELECT id, title, type, video_url, video_urls FROM training_materials WHERE type = \'video\''
  );
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
