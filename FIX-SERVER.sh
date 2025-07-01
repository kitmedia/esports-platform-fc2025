#!/bin/bash

echo "🔧 Reparando servidor de producción..."
echo "=================================="

# 1. Diagnóstico inicial
echo "📊 Estado actual del servidor:"
echo "------------------------------"
docker ps -a
echo ""
echo "🌐 Conectividad:"
curl -s http://localhost:3001/health || echo "❌ Backend no responde"
echo ""

# 2. Limpiar todo
echo "🧹 Limpiando contenedores..."
docker-compose down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# 3. Actualizar código
echo "📥 Actualizando código..."
cd /root/esports-platform-fc2025
git pull origin main

# 4. Solución simple - ejecutar sin Docker
echo "🚀 Iniciando backend directamente..."
cd backend

# Instalar dependencias
npm install

# Matar procesos anteriores
pkill -f "node.*server" || true
pkill -f "npm.*start" || true

# Verificar que tenemos los archivos necesarios
if [ ! -f "src/server.ts" ]; then
    echo "❌ Archivo server.ts no encontrado"
    exit 1
fi

# Crear .env si no existe
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/esports_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
NODE_ENV="production"
PORT=3001
EOF
fi

# Iniciar PostgreSQL si no está corriendo
if ! pgrep postgres > /dev/null; then
    echo "🐘 Iniciando PostgreSQL..."
    sudo service postgresql start
fi

# Iniciar Redis si no está corriendo
if ! pgrep redis > /dev/null; then
    echo "🔴 Iniciando Redis..."
    sudo service redis-server start
fi

# Compilar y ejecutar
echo "⚡ Compilando TypeScript..."
npx tsc src/server.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --skipLibCheck --resolveJsonModule

if [ $? -eq 0 ]; then
    echo "✅ Compilación exitosa"
    echo "🚀 Iniciando servidor..."
    cd dist
    nohup node server.js > /var/log/esports-backend.log 2>&1 &
    echo "Backend iniciado en background"
else
    echo "❌ Error de compilación, ejecutando directamente con ts-node..."
    cd /root/esports-platform-fc2025/backend
    nohup npx ts-node src/server.ts > /var/log/esports-backend.log 2>&1 &
fi

# Verificar que esté funcionando
echo "⏳ Esperando que el servidor inicie..."
sleep 5

echo "🧪 Probando conectividad..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ ¡Servidor funcionando!"
    echo "🌐 Prueba externa: http://164.92.239.38:3001/health"
    curl -s http://localhost:3001/api/status
else
    echo "❌ Servidor no responde, revisando logs..."
    tail -n 20 /var/log/esports-backend.log
fi

echo ""
echo "🎯 Estado final:"
ps aux | grep -E "(node|ts-node)" | grep -v grep
echo ""
echo "📋 Para ver logs: tail -f /var/log/esports-backend.log"