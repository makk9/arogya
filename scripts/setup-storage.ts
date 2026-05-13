import { supabaseAdmin } from "@/lib/supabase";

// Must match STORAGE_BUCKET in lib/storage.ts. Inlined here because lib/storage.ts
// uses "server-only", which throws when imported outside Next.js bundling.
const BUCKET = "arogya";

async function main() {
  const { data: existing, error: listError } =
    await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw new Error(`listBuckets failed: ${listError.message}`);
  }

  const already = existing?.find((b) => b.name === BUCKET);
  if (already) {
    console.log(`bucket exists: ${BUCKET} (public=${already.public})`);
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    BUCKET,
    { public: false },
  );

  if (createError) {
    throw new Error(`createBucket failed: ${createError.message}`);
  }

  console.log(`created bucket: ${BUCKET} (private)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
