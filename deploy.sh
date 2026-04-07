#!/bin/bash

echo "🚀 Iniciando despliegue de inventario-back..."

# Pull últimos cambios
echo "📥 Descargando cambios..."
git pull origin main

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install --production=false

# Compilar TypeScript
echo "🔨 Compilando..."
npm run build

# Generar cliente Prisma
echo "🗄️ Generando cliente Prisma..."
npx prisma generate

# Ejecutar migraciones
echo "🗃️ Ejecutando migraciones..."
npx prisma migrate deploy

# Crear carpeta de logs si no existe
mkdir -p logs

# Reiniciar con PM2
echo "🔄 Reiniciando servidor..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "✅ Despliegue completado!"
pm2 status
