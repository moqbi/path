-- وضعُ التخفّي لمشتركي آثار+ (القاعدة ٢٥١).
ALTER TABLE "User" ADD COLUMN "hideOnline" BOOLEAN NOT NULL DEFAULT false;
