
# Build Angular
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Nginx
FROM nginx:alpine

# Ajuste conforme a pasta de build do seu Angular.
# Angular moderno geralmente gera dist/<projeto>/browser.
ARG DIST_DIR=dist/classmate/browser

COPY --from=build /app/${DIST_DIR}/ /usr/share/nginx/html/

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Substituir somente API_URL, preservando as variaveis do Nginx.
ENV NGINX_ENVSUBST_FILTER=^API_URL$

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
