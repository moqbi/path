-- الثيمُ بألوانٍ يُرسم من ألوانه (paletteSpec): ما حُفظ قبلها بقي بتدرّجٍ كهرمانيّ.
UPDATE "StoreItem"
SET "spec" = 'linear-gradient(135deg,' || ("palette"::jsonb ->> 'accent') || ','
  || ("palette"::jsonb ->> 'card') || ' 55%,' || ("palette"::jsonb ->> 'paper') || ')'
WHERE "kind" = 'THEME'
  AND "palette" IS NOT NULL
  AND ("palette"::jsonb ->> 'accent') ~ '^#[0-9a-fA-F]{6}$'
  AND ("palette"::jsonb ->> 'card') ~ '^#[0-9a-fA-F]{6}$'
  AND ("palette"::jsonb ->> 'paper') ~ '^#[0-9a-fA-F]{6}$';
