-- كلُّ حسابٍ قائم يتابع حسابَ الإدارة كما يتابعه كلُّ حسابٍ جديد (القاعدة ٣٧٢).
-- الحسابُ من `support.member` (الافتراضيّ ١، والأرقامُ العربيّة تُحوَّل)، ومفتوحٌ وحده.
-- ولا يُمسّ من بينه وبينه صفٌّ في أيّ اتجاه، ولا من بينهما حظر.
WITH s AS (
  SELECT u.id FROM "User" u
  WHERE u."isOpen" = true
    AND u."memberNo"::text = COALESCE(
      (SELECT NULLIF(regexp_replace(translate(value, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g'), '')
         FROM "SiteText" WHERE key = 'support.member'),
      '1')
)
INSERT INTO "Friendship" (id, "requesterId", "addresseeId", status, "createdAt", "acceptedAt", follow)
SELECT 'fs' || md5(u.id || s.id), u.id, s.id, 'ACCEPTED', now(), now(), true
FROM "User" u CROSS JOIN s
WHERE u.id <> s.id
  AND NOT EXISTS (SELECT 1 FROM "Friendship" f
    WHERE (f."requesterId" = u.id AND f."addresseeId" = s.id)
       OR (f."requesterId" = s.id AND f."addresseeId" = u.id))
  AND NOT EXISTS (SELECT 1 FROM "Block" b
    WHERE (b."blockerId" = u.id AND b."blockedId" = s.id)
       OR (b."blockerId" = s.id AND b."blockedId" = u.id))
ON CONFLICT DO NOTHING;
