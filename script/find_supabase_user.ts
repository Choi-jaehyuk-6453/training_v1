import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
        auth: {
            persistSession: false,
        },
    }
);

async function main() {
    console.log("Searching Supabase Auth for 한정수...");
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        console.log("Total Auth Users:", users.length);
        const targetUsers = users.filter(u => u.email?.includes("5354-8355") || u.email?.includes("53548355") || u.user_metadata?.name === "한정수");

        console.log("Found matching Auth Users:", targetUsers.length);
        targetUsers.forEach(u => {
            console.log(`- Email: ${u.email}, Name: ${u.user_metadata?.name}, CreatedApp: ${u.created_at}, ID: ${u.id}`);
        });

    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

main();
