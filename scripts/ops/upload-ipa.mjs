#!/usr/bin/env node
/**
 * رفعُ نسخة iOS إلى App Store Connect من لينكس — بلا ماك ولا Transporter.
 *
 * يمرّ بواجهة أبل الرسميّة (`/v1/buildUploads`): حجزُ رفعٍ للنسخة، ثمّ حجزُ
 * ملفّ، ثمّ رفعُ أجزائه إلى الروابط التي تعطيها أبل، ثمّ «تمّ» مع بصمة MD5،
 * ثمّ انتظارُ المعالجة. وللمرّة التي يعلق فيها طابورُ إكسبو.
 *
 * المفتاحُ يبقى على الجهاز: يُقرأ ملفّ `.p8` من مساره ولا يُطبع ولا يُرسل
 * إلا توقيعاً (JWT صالحاً عشرين دقيقة). وبلا اعتماديّات — `crypto` وحدها.
 *
 *   ASC_KEY_ID=…  ASC_ISSUER_ID=…  ASC_KEY_PATH=~/AuthKey_….p8 \
 *   node scripts/ops/upload-ipa.mjs ./athar-19.ipa 6814671198 0.1.0 19
 */
import { createHash, createSign } from "node:crypto";
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";

const [file, appId, version, build] = process.argv.slice(2);
const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuer, ASC_KEY_PATH: keyPath } = process.env;
if (!file || !appId || !version || !build || !keyId || !issuer || !keyPath) {
  console.error(
    "الاستعمال:\n  ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=…/AuthKey.p8 \\\n  node upload-ipa.mjs <ملف.ipa> <ASC App ID> <الإصدار> <رقم البناء>",
  );
  process.exit(1);
}

/*
  فحصٌ قبل أن نسأل أبل: ٤٠١ منها لا يقول أيُّ الثلاثة خطأ. رقمُ المفتاح عشرُ
  خاناتٍ حروفاً كبيرةً وأرقاماً، ورقمُ الإصدار UUID، والملفّ مفتاحٌ خاصّ.
  ومفتاحٌ «فرديّ» (Individual) لا رقمَ إصدارٍ له: يُوقَّع بـ`sub: user` بدل `iss`.
*/
const individual = issuer === "individual";
if (!/^[A-Z0-9]{10}$/.test(keyId)) {
  console.error(`✗ ASC_KEY_ID ليس رقمَ مفتاح (عشر خانات A-Z و0-9) — طوله ${keyId.length}.`);
  process.exit(1);
}
if (!individual && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issuer)) {
  console.error(`✗ ASC_ISSUER_ID ليس بصيغة xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx — طوله ${issuer.length}.`);
  process.exit(1);
}
{
  const pem = readFileSync(keyPath, "utf8");
  if (!pem.includes("BEGIN PRIVATE KEY") || !pem.includes("END PRIVATE KEY")) {
    console.error("✗ ملفّ المفتاح لا يبدأ بـ BEGIN PRIVATE KEY أو لا ينتهي بـ END PRIVATE KEY.");
    process.exit(1);
  }
  }
console.log(`ساعة الخادم (UTC): ${new Date().toISOString()} — يجب أن تطابق الوقت الحقيقيّ بدقائق.`);

const API = "https://api.appstoreconnect.apple.com";
const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** توقيعُ ES256 بصيغة JOSE (r‖s) لا DER — وإلّا ردّت أبل ٤٠١. */
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  // `iat` قبل دقيقة: ساعةُ خادمٍ متقدّمةٌ قليلاً تجعل التوكن «من المستقبل» فيُردّ ٤٠١.
  const claims = individual
    ? { sub: "user", iat: now - 60, exp: now + 1100, aud: "appstoreconnect-v1" }
    : { iss: issuer, iat: now - 60, exp: now + 1100, aud: "appstoreconnect-v1" };
  const body = b64url(JSON.stringify(claims));
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  const sig = signer.sign({ key: readFileSync(keyPath, "utf8"), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

async function asc(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

// فحصُ الدخول وحده قبل أيّ رفع: يقرأ التطبيق نفسه.
if (process.env.CHECK_ONLY) {
  const app = await asc("GET", `/v1/apps/${appId}?fields[apps]=name,bundleId`);
  console.log(`✓ الدخول سليم — ${app.data.attributes.name} (${app.data.attributes.bundleId})`);
  process.exit(0);
}

const size = statSync(file).size;
const name = file.split("/").pop();
const md5 = createHash("md5").update(readFileSync(file)).digest("hex");
console.log(`الملف: ${name} — ${(size / 1048576).toFixed(1)} ميغا — MD5 ${md5}`);

// ١. حجزُ رفعٍ لهذه النسخة.
const upload = await asc("POST", "/v1/buildUploads", {
  data: {
    type: "buildUploads",
    attributes: { cfBundleShortVersionString: version, cfBundleVersion: build, platform: "IOS" },
    relationships: { app: { data: { type: "apps", id: appId } } },
  },
});
const uploadId = upload.data.id;
console.log(`١/٥ حُجز الرفع: ${uploadId}`);

// ٢. حجزُ الملفّ — والردُّ يحمل روابطَ أجزائه.
const reserved = await asc("POST", "/v1/buildUploadFiles", {
  data: {
    type: "buildUploadFiles",
    attributes: { assetType: "ASSET", fileName: name, fileSize: size, uti: "com.apple.ipa" },
    relationships: { buildUpload: { data: { type: "buildUploads", id: uploadId } } },
  },
});
const fileId = reserved.data.id;
const ops = reserved.data.attributes.uploadOperations ?? [];
console.log(`٢/٥ حُجز الملف: ${ops.length} جزءاً`);

// ٣. رفعُ الأجزاء كما وصفتها أبل: الإزاحةُ والطولُ والترويساتُ منها لا منّا.
const fd = openSync(file, "r");
try {
  for (const [i, op] of ops.entries()) {
    const chunk = Buffer.alloc(op.length);
    readSync(fd, chunk, 0, op.length, op.offset);
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(op.url, { method: op.method, headers, body: chunk });
      if (res.ok) break;
      if (attempt >= 4) throw new Error(`الجزء ${i + 1}: ${res.status} ${await res.text()}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
    process.stdout.write(`\r٣/٥ رُفع ${i + 1} من ${ops.length}`);
  }
} finally {
  closeSync(fd);
}
console.log();

// ٤. «تمّ» ومعه البصمة: أبل تقارن ما وصلها بما أُرسل.
await asc("PATCH", `/v1/buildUploadFiles/${fileId}`, {
  data: {
    type: "buildUploadFiles",
    id: fileId,
    attributes: { uploaded: true, sourceFileChecksums: { file: { algorithm: "MD5", hash: md5 } } },
  },
});
console.log("٤/٥ أُبلغت أبل باكتمال الرفع");

// ٥. انتظارُ المعالجة — حتى نصف ساعة، ثمّ تُتابَع من App Store Connect.
for (let i = 0; i < 60; i++) {
  const now = await asc("GET", `/v1/buildUploads/${uploadId}`);
  const st = now.data.attributes.state ?? {};
  process.stdout.write(`\r٥/٥ الحالة: ${st.state ?? "؟"}            `);
  if (st.state === "COMPLETE") {
    console.log("\n✓ وصلت النسخة. تظهر في App Store Connect بعد معالجة أبل.");
    for (const w of st.warnings ?? []) console.log("  تنبيه:", w.code, w.description);
    process.exit(0);
  }
  if (st.state === "FAILED") {
    console.log("\n✗ ردّتها أبل:");
    for (const e of st.errors ?? []) console.log("  ", e.code, e.description);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}
console.log("\nما زالت تُعالج — تابعها من App Store Connect ← TestFlight.");
