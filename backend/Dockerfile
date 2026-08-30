FROM node:20-bullseye AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6 \
    libstdc++6 \
    libgcc-s1 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

FROM node:20-bullseye

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
