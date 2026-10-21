# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./

RUN --mount=type=cache,target=/root/.npm \
	npm install --no-audit --no-fund

COPY . .

# Адрес API в браузере: пусто = относительные ./api (на тот же хост, что и SPA)
ARG VITE_BASE_URL=""
ARG VITE_TIMEOUT_INTERVAL=10000
ARG VITE_IS_DEV=false

ENV VITE_BASE_URL=$VITE_BASE_URL \
	VITE_TIMEOUT_INTERVAL=$VITE_TIMEOUT_INTERVAL \
	VITE_IS_DEV=$VITE_IS_DEV

RUN npm run build

FROM nginx:1.27-alpine AS production

ENV PORT=3000 \
	NGINX_ENVSUBST_FILTER=PORT|API_UPSTREAM

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
