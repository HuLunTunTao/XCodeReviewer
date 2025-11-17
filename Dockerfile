FROM node:18-alpine AS builder

WORKDIR /app

ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV http_proxy=""
ENV https_proxy=""
ENV NO_PROXY="*"
ENV no_proxy="*"

RUN npm config set registry https://registry.npmjs.org/ && \
    npm config delete proxy 2>/dev/null || true && \
    npm config delete https-proxy 2>/dev/null || true && \
    npm config delete http-proxy 2>/dev/null || true && \
    npm install -g pnpm && \
    apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_PORT=4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

VOLUME ["/app/data"]

EXPOSE 4000

CMD ["node", "server/index.js"]
