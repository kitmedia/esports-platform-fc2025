#!/bin/bash

echo "🔧 Reconstruyendo el backend con todas las funcionalidades..."

# Parar servicios
docker-compose down

# Reconstruir el backend con todas las dependencias
cd backend
docker build --no-cache -t esports-platform-fc2025-backend -f ../docker/Dockerfile.backend ..
cd ..

# Reiniciar servicios
docker-compose up -d

echo "✅ Backend reconstruido con todas las rutas API!"
echo "🚀 Esperando a que los servicios inicien..."
sleep 10

# Verificar el estado
docker-compose ps
docker-compose logs backend --tail=20

echo "🔍 Verificando las rutas API..."
curl http://164.92.239.38:3001/api/status
echo ""
curl http://164.92.239.38:3001/api/tournaments
echo ""

echo "✅ Proceso completado. Revisa la plataforma en http://164.92.239.38:3000"