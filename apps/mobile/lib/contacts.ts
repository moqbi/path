import { requireOptionalNativeModule } from "expo";
import * as Crypto from "expo-crypto";
import { CONTACTS_MAX, normalizePhone } from "@athar/shared";
import { api } from "./api";
import type { FoundPerson } from "./add-friend";

/**
 * مزامنةُ جهات الاتصال (القاعدة ٢٩٧). **الوحدةُ اختياريّة** (القاعدة ١٢٤): بناءٌ
 * قديمٌ بلاها يُقال له «يحتاج تحديث التطبيق» ولا يسقط، فلا يُرفع رقمُ الإصدار لأجلها.
 * والحزمةُ تُستورد بعد ثبوت الوحدة — استيرادُها بلاها يرمي ساعةَ التحميل.
 */
export const contactsReady = requireOptionalNativeModule("ExpoContacts") !== null;

type Outcome = { people: FoundPerson[]; scanned: number } | { denied: true } | { unavailable: true };

/**
 * يقرأ الأرقامَ وحدها (لا أسماءَ ولا صور)، ويطبّعها بالنسخة نفسها التي يطبّع بها
 * الخادمُ الرقمَ المؤكَّد، ويجزّئها على الجهاز — فلا يخرج رقمٌ واحدٌ كما هو.
 */
export async function syncContacts(): Promise<Outcome> {
  if (!contactsReady) return { unavailable: true };
  const Contacts = await import("expo-contacts");
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") return { denied: true };

  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
  const numbers = new Set<string>();
  for (const contact of data) {
    for (const entry of contact.phoneNumbers ?? []) {
      const e164 = normalizePhone(entry.number ?? entry.digits ?? "");
      if (e164) numbers.add(e164);
    }
  }
  const all = [...numbers].slice(0, CONTACTS_MAX);
  const hashes = await Promise.all(all.map((n) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, n)));
  if (hashes.length === 0) return { people: [], scanned: 0 };
  const res = await api<{ people: FoundPerson[] }>("/v1/circle/contacts", {
    method: "POST",
    body: JSON.stringify({ hashes: hashes.map((h) => h.toLowerCase()) }),
  });
  return { people: res.people, scanned: all.length };
}
