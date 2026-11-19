FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* values are compiled into the browser bundle at build time
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_FASTAPI_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_FASTAPI_BACKEND_URL=$NEXT_PUBLIC_FASTAPI_BACKEND_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
