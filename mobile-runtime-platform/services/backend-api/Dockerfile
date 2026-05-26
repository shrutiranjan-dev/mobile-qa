FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY services/backend-api ./services/backend-api

RUN npm install

EXPOSE 4000

CMD ["npm", "--workspace", "@mrp/backend-api", "run", "start"]