import "dotenv/config";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET ?? "hukuk-pdf";

async function main() {
  let token: string | undefined;
  let total = 0;
  let totalBytes = 0;
  do {
    const r = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    r.Contents?.forEach((o) => {
      total++;
      totalBytes += o.Size ?? 0;
      console.log(`${(o.Size ?? 0).toString().padStart(10)} ${o.Key}`);
    });
    token = r.NextContinuationToken;
  } while (token);
  console.log(`\nToplam: ${total} dosya, ${(totalBytes / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
