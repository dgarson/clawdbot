FROM node:22-slim AS build

WORKDIR /app

COPY package.json ./

RUN corepack enable && pnpm install

COPY src ./src
COPY tsconfig.json ./

RUN pnpm build

FROM node:22-slim AS runtime

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist

RUN corepack enable && pnpm install --prod

EXPOSE 8080

CMD ["node", "dist/index.js"]
