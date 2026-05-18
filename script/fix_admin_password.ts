import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function run() {
  // admin@example.com 계정 찾기
  const { data: listData } = await supabase.auth.admin.listUsers();
  const adminUser = listData?.users?.find(u => u.email === "admin@example.com");

  if (!adminUser) {
    console.log("❌ admin@example.com 계정이 없습니다. 새로 생성합니다...");
    const { data, error } = await supabase.auth.admin.createUser({
      email: "admin@example.com",
      password: "admin123",
      email_confirm: true,
      user_metadata: { role: "admin", name: "관리자" }
    });
    if (error) {
      console.error("❌ 생성 실패:", error.message);
    } else {
      console.log("✅ admin 계정 생성 완료:", data.user?.id);
    }
    return;
  }

  console.log("✅ admin 계정 발견:", adminUser.id, adminUser.email);

  // 비밀번호를 admin123으로 업데이트
  const { error } = await supabase.auth.admin.updateUserById(adminUser.id, {
    password: "admin123",
    email_confirm: true,
  });

  if (error) {
    console.error("❌ 비밀번호 업데이트 실패:", error.message);
  } else {
    console.log("✅ 관리자 비밀번호가 admin123으로 업데이트되었습니다.");
    console.log("   로그인: username=관리자, password=admin123");
  }
}

run().catch(console.error);
