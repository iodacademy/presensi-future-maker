# syntax=docker/dockerfile:1

# ---- Tahap 1: dependensi / Stage 1: dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci mengikuti lockfile persis; npm install boleh menaikkan versi diam-diam.
# npm ci follows the lockfile exactly; npm install may silently bump versions.
RUN npm ci

# ---- Tahap 2: build / Stage 2: build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variabel NEXT_PUBLIC_* dibaca peramban dan ikut dibekukan ke dalam bundel saat
# build, jadi harus tersedia di sini -- menyetelnya saat runtime tidak berpengaruh.
# Nilainya bukan rahasia: memang dikirim ke setiap pengunjung.
#
# NEXT_PUBLIC_* variables are read by the browser and are frozen into the bundle
# at build time, so they must be present here -- setting them at runtime has no
# effect. They are not secrets: they ship to every visitor anyway.
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# FIREBASE_PROJECT_ID dibutuhkan saat build karena halaman yang dirender di muka
# menyentuh Firebase Admin. Kredensialnya sendiri tidak dibutuhkan: di Cloud Run
# identitas datang dari metadata server saat runtime.
#
# FIREBASE_PROJECT_ID is needed at build time because prerendered pages touch
# Firebase Admin. The credentials themselves are not: on Cloud Run the identity
# comes from the metadata server at runtime.
ENV FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID

RUN npm run build

# ---- Tahap 3: runtime ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Jalankan sebagai pengguna biasa: proses yang ditembus penyerang tidak langsung
# memegang root di dalam container.
# Run as an unprivileged user: a compromised process does not immediately hold
# root inside the container.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Folder standalone memuat server.js beserta dependensi yang benar-benar dipakai.
# The standalone folder carries server.js plus only the dependencies actually used.
COPY --from=builder --chown=nextjs:nodejs /app/.next-build/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next-build/static ./.next-build/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Jaring pengaman: Next.js menyalin berkas tak dikenal di root proyek ke folder
# standalone. .dockerignore sudah mencegahnya ikut, dan baris ini memastikan
# sekali lagi -- kunci privat dalam image tersebar ke setiap tempat image itu
# ditarik.
#
# Safety net: Next.js copies unrecognised root-level files into the standalone
# folder. .dockerignore already keeps them out, and this line makes sure once
# more -- a private key inside an image spreads everywhere that image is pulled.
RUN rm -f service-account*.json .env .env.local

USER nextjs

# Cloud Run menetapkan PORT saat runtime dan container wajib mendengarkan di
# sana; 8080 hanyalah nilai bawaan bila variabel tidak diberikan.
# Cloud Run assigns PORT at runtime and the container must listen on it; 8080 is
# merely the default when the variable is absent.
ENV PORT=8080 \
    HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
