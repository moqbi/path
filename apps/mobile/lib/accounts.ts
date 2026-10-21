import { deleteItem, getItem, setItem } from "./store";

/**
 * الحسابات على هذا الجهاز — حسابان على الأكثر (القاعدة ٣١٦).
 *
 * القائمةُ وجوهٌ تُرسم في النافذة قبل أن يُسأل الخادم: اسمٌ وصورةٌ ورقم،
 * ولا سرَّ فيها. وتوكنُ التجديد للحساب **المركون** وحده في مفتاحٍ باسمه
 * (`athr.acct.<id>`)، والنشطُ على مفتاحيه المعتادين: توكنُ التجديد يُبدَّل مع
 * كلّ تجديد، ونسخةٌ ثانيةٌ للنشط تبقى قديمةً فيقرؤها الخادمُ إعادةَ استعمالٍ
 * لتوكنٍ مستهلك — أي سرقة.
 */
export const MAX_ACCOUNTS = 2;

export type Account = {
  id: string;
  name: string;
  memberNo: number;
  avatarMediaId: string | null;
};

const LIST = "athr.accounts";
const parkedKey = (id: string) => `athr.acct.${id.replace(/[^A-Za-z0-9._-]/g, "")}`;

export async function listAccounts(): Promise<Account[]> {
  try {
    const raw = await getItem(LIST);
    const rows = raw ? (JSON.parse(raw) as Account[]) : [];
    return Array.isArray(rows) ? rows.slice(0, MAX_ACCOUNTS) : [];
  } catch {
    return [];
  }
}

async function writeAccounts(rows: Account[]): Promise<void> {
  await setItem(LIST, JSON.stringify(rows.slice(0, MAX_ACCOUNTS))).catch(() => undefined);
}

/** يُكتب وجهُ الحساب النشط مع كلّ قراءةٍ لـ`/v1/me` فلا يبقى اسمٌ قديم في النافذة. */
export async function rememberAccount(face: Account): Promise<void> {
  const rows = await listAccounts();
  const at = rows.findIndex((row) => row.id === face.id);
  const same =
    at >= 0 &&
    rows[at].name === face.name &&
    rows[at].avatarMediaId === face.avatarMediaId &&
    rows[at].memberNo === face.memberNo;
  if (same) return;
  if (at >= 0) rows[at] = face;
  else rows.push(face);
  await writeAccounts(rows);
}

export async function forgetAccount(id: string): Promise<void> {
  const rows = await listAccounts();
  await writeAccounts(rows.filter((row) => row.id !== id));
  await deleteItem(parkedKey(id)).catch(() => undefined);
}

export async function parkToken(id: string, refreshToken: string): Promise<void> {
  await setItem(parkedKey(id), refreshToken);
}

/** يُؤخذ التوكنُ ويُمحى من مكانه: الحسابُ صار نشطاً، ونسختُه هنا تقدم. */
export async function takeParked(id: string): Promise<string | null> {
  const token = await getItem(parkedKey(id)).catch(() => null);
  await deleteItem(parkedKey(id)).catch(() => undefined);
  return token;
}

export async function peekParked(id: string): Promise<string | null> {
  return getItem(parkedKey(id)).catch(() => null);
}
