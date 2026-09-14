-- الهدية تُكتب سطراً في مخطط الطرفين
ALTER TYPE "MomentKind" ADD VALUE IF NOT EXISTS 'GIFT_SENT';
ALTER TYPE "MomentKind" ADD VALUE IF NOT EXISTS 'GIFT_GOT';
