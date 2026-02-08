FROM node:22-alpine AS deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_DEMO_CODE_REQUIRED
ARG NEXT_PUBLIC_ENABLE_ACCOUNT_AUTH
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_DEMO_CODE_REQUIRED=$NEXT_PUBLIC_DEMO_CODE_REQUIRED
ENV NEXT_PUBLIC_ENABLE_ACCOUNT_AUTH=$NEXT_PUBLIC_ENABLE_ACCOUNT_AUTH
ENV NODE_ENV=production

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
