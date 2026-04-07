import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } }
);

async function main() {
    console.log("Testing user interaction...");
    
    // Test creating a user with 4 chars
    const email = "test_pwd_12345@example.com";
    const password = "1234";

    console.log(`Creating user with 4 chars...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (createError) {
        console.error("Create error:", createError.message);
    } else {
        console.log("User created fine with 4 chars! ID:", newUser.user?.id);
        
        console.log(`Updating user with another 4 chars...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(newUser.user!.id, {
            password: "5678"
        });
        
        if (updateError) {
            console.error("Update error:", updateError.message);
        } else {
            console.log("User updated fine with 4 chars!");
        }

        await supabase.auth.admin.deleteUser(newUser.user!.id);
    }
}
main();
