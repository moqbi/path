# خادم أثر — صورةٌ واحدة تعمل على أيّ VPS بلا تخصيصٍ لمزوّد.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# طبقة الاعتماديات وحدها: تغييرُ الكود لا يعيد تنزيلها.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @athar/api...

FROM base AS runner
ENV NODE_ENV=production
# ffmpeg لمعالجة الصوت والفيديو، ولا شيء غيره: كل حزمةٍ زائدة سطحُ هجوم.
RUN apk add --no-cache ffmpeg
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @athar/db generate

# لا يعمل بـroot: ثغرةٌ في العملية لا تصير ثغرةً في الحاوية.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["pnpm", "--filter", "@athar/api", "start"]
