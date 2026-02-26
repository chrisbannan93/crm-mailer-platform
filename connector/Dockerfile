FROM node:20-alpine AS deps
WORKDIR /app
COPY connector/package.json connector/package-lock.json* ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY connector/package.json connector/tsconfig.json ./
COPY connector/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY verticals ./verticals
COPY connector/package.json ./package.json
EXPOSE 4010
CMD ["node", "dist/index.js"]
