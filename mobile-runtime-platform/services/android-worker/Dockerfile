FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre \
    adb \
    aapt \
    unzip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY services/android-worker ./services/android-worker

RUN npm install

ENV ADB_BIN=/usr/bin/adb
ENV AAPT_BIN=/usr/bin/aapt

EXPOSE 6060

CMD ["npm", "--workspace", "@mrp/android-worker", "run", "start"]