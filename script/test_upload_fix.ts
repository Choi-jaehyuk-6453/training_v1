
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function testUpload() {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing env vars");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    });
    console.log("Script Supabase URL:", supabaseUrl);

    console.log("Checking buckets...");
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
        console.error("Error listing buckets:", bucketError);
    } else {
        const uploadBucket = buckets.find(b => b.name === 'uploads');
        if (uploadBucket) {
            console.log("Uploads bucket found:", uploadBucket);
        } else {
            console.log("Uploads bucket NOT found. Creating...");
            const { data, error } = await supabase.storage.createBucket('uploads', {
                public: true,
                fileSizeLimit: 52428800,
                allowedMimeTypes: ['image/*', 'application/pdf']
            });
            if (error) {
                console.error("Failed to create bucket:", error);
                // process.exit(1); // Optional: stop if bucket creation fails
            } else {

            }
        }
    }

    // TEST DIRECT UPLOAD
    console.log("Testing direct upload with Service Role Key...");
    // Create a 1x1 pixel PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==', 'base64');

    const { data: uploadDataDirect, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload('test_direct_upload.png', pngBuffer, {
            upsert: true,
            contentType: 'image/png'
        });

    if (uploadError) {
        console.error("Direct upload failed:", uploadError);
    } else {
        console.log("Direct upload successful:", uploadDataDirect);
    }

    // TEST CREATE SIGNED UPLOAD URL LOCALLY
    console.log("Testing createSignedUploadUrl locally with Service Role Key...");
    const { data: signedData, error: signedError } = await supabase.storage
        .from('uploads')
        .createSignedUploadUrl('public/test_signed_url.png'); // Match folder structure

    if (signedError) {
        console.error("Local signed URL creation failed:", signedError);
    } else {
        console.log("Local signed URL creation successful:", signedData);
    }

    const loginUrl = "http://localhost:5000/api/login";
    const uploadEndpoint = "http://localhost:5000/api/uploads";

    // 1. Login
    console.log("Logging in...");
    const loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "관리자", password: "admin123" }),
    });

    if (!loginRes.ok) {
        console.error("Login failed:", await loginRes.text());
        process.exit(1);
    }

    const loginData = await loginRes.json();
    const token = loginData.session.access_token;
    console.log("Login successful, token received.");

    // 2. Upload File (Proxy)
    const testFilename = "테스트_이미지_[brackets].png";
    console.log(`Uploading file (Proxy): ${testFilename}`);

    // Reusing pngBuffer from earlier in the script (assuming it's available in scope, but wait, it's defined inside function scope? Yes, inside testUpload)
    // Need to recreate it or ensure scope. It was defined at line 51. Replacement is from 78. It's fine.

    // Node.js globals for FormData/Blob (Node 18+)
    const fileBlob = new Blob([pngBuffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("file", fileBlob, testFilename);

    const uploadRes = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
    });

    if (!uploadRes.ok) {
        console.error("Upload failed:", await uploadRes.text());
        process.exit(1);
    }

    const uploadData = await uploadRes.json();
    console.log("Upload successful response:", uploadData);

    if (uploadData.objectPath && uploadData.objectPath.includes("http")) {
        console.log("SUCCESS: Received valid public URL!");
        console.log("Public URL:", uploadData.objectPath);
    } else {
        console.log("WARNING: Unexpected response format.");
    }
}

testUpload();
