# Máy chủ phòng chơi (server/) cùng lõi chiến đấu dùng chung (shared/). Client không cần ở đây.
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server --include-workspace-root --no-audit --no-fund
COPY shared/src shared/src
COPY server/src server/src
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/src/server.ts"]
