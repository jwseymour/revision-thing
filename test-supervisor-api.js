require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // use service role to bypass RLS for a test insertion! Wait, I don't have SUPABASE_SERVICE_ROLE_KEY in .env.local usually
  );

  console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
test();
