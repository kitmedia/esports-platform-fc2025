# 🔧 Comandos de Integración Frontend-Backend

## Problema Identificado
El frontend está configurado para puerto 3001 pero el backend corre en 3002.

## Solución en el Servidor de Producción

### Opción 1: Cambiar el Backend al Puerto 3001

```bash
# En el servidor
cd /root/esports-platform-fc2025/backend

# Parar el backend actual
pkill -f simple-server

# Actualizar el puerto a 3001
sed -i 's/3002/3001/g' simple-server.js

# Parar lo que esté usando puerto 3001
docker-compose down
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Ejecutar en puerto 3001
node simple-server.js &

# Verificar
curl http://164.92.239.38:3001/health
curl http://164.92.239.38:3001/api/status
```

### Opción 2: Reconstruir el Frontend con Puerto 3002

```bash
# En el servidor
cd /root/esports-platform-fc2025

# Actualizar archivos de configuración
echo 'VITE_API_URL=http://164.92.239.38:3002
VITE_WS_URL=http://164.92.239.38:3002' > frontend/.env

# Reconstruir el frontend
docker-compose stop frontend
docker-compose rm -f frontend
docker-compose build frontend --no-cache
docker-compose up -d frontend

# Verificar
docker-compose logs frontend
```

### Opción 3: Proxy con Nginx (Más Rápida)

```bash
# Crear proxy para redirigir 3001 -> 3002
docker run -d --name nginx-proxy -p 3001:80 nginx:alpine

docker exec nginx-proxy sh -c 'cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen 80;
    location / {
        proxy_pass http://164.92.239.38:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF'

docker exec nginx-proxy nginx -s reload

# Probar
curl http://164.92.239.38:3001/health
```

## Verificación Final

Después de aplicar cualquier solución:

1. Ve a http://164.92.239.38:3000
2. Intenta registrarte
3. Debería funcionar correctamente

## Solución Recomendada

**Usa la Opción 1** - Es la más simple y rápida.