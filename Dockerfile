# Estágio 1: Build do Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Estágio 2: Runtime do Backend
FROM node:22-alpine
WORKDIR /app

# Copia as dependências do backend
COPY package*.json ./
RUN npm ci --omit=dev

# Copia o código do servidor
COPY . .

# Copia o frontend buildado do estágio anterior para a pasta correta
COPY --from=frontend-builder /app/client/dist ./client/dist

# Define variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Expõe a porta do servidor
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "src/server.js"]
