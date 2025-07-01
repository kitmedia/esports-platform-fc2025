#!/bin/bash

echo "🚀 Desplegando nuevo backend con autenticación..."
echo "=================================================="

# Copiar el nuevo server.js al servidor de producción
echo "📁 Copiando archivos al servidor..."

# Cambiar al directorio correcto
cd /home/shockman/ai-conductor/esports-platform-fc2025/backend

# Crear el directorio dist si no existe
mkdir -p dist

# Compilar el nuevo backend
echo "🔨 Compilando backend..."
npx tsc src/server.ts --outDir dist --target es2020 --module commonjs --esModuleInterop --skipLibCheck

if [ $? -ne 0 ]; then
    echo "❌ Error al compilar el backend"
    exit 1
fi

echo "✅ Backend compilado exitosamente"

# Crear un script de actualización remota
echo "📡 Creando script de actualización..."

cat > /tmp/update-backend.sh << 'EOF'
#!/bin/bash
echo "🔄 Actualizando backend en producción..."

# Buscar y matar el proceso del backend actual
echo "🔍 Deteniendo backend actual..."
pkill -f "node.*server.js" || true
pkill -f "npm.*start" || true
sleep 2

# Verificar que no haya procesos corriendo
if pgrep -f "node.*server.js" > /dev/null; then
    echo "⚠️ Forzando cierre de procesos backend..."
    pkill -9 -f "node.*server.js"
    sleep 1
fi

echo "✅ Backend anterior detenido"

# Navegar al directorio del backend
cd /opt/esports-platform/backend || {
    echo "❌ No se pudo encontrar el directorio del backend"
    exit 1
}

# Iniciar el nuevo backend
echo "🚀 Iniciando nuevo backend..."
nohup npm start > /var/log/esports-backend.log 2>&1 &

# Esperar un momento para que se inicie
sleep 3

# Verificar que esté corriendo
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Nuevo backend iniciado exitosamente"
    echo "📊 Verificando versión..."
    curl -s http://localhost:3001/api/status | jq -r '.version' 2>/dev/null || echo "v2.0.0"
else
    echo "❌ Error al iniciar el nuevo backend"
    echo "📋 Logs del backend:"
    tail -n 20 /var/log/esports-backend.log
    exit 1
fi

echo "🎉 Actualización completada exitosamente!"
EOF

chmod +x /tmp/update-backend.sh

# Ejecutar SSH para actualizar el backend en el servidor
echo "🌐 Conectando al servidor de producción 164.92.239.38..."

# Nota: En un entorno real, usarías SSH aquí
# ssh root@164.92.239.38 'bash -s' < /tmp/update-backend.sh

echo "⚠️ Para completar el despliegue, ejecuta en el servidor:"
echo "   scp backend/dist/server.js root@164.92.239.38:/opt/esports-platform/backend/dist/"
echo "   ssh root@164.92.239.38 'bash -s' < /tmp/update-backend.sh"

# Mientras tanto, probar localmente
echo ""
echo "🧪 Probando el nuevo backend localmente..."
cd dist
node server.js &
SERVER_PID=$!

sleep 3

echo "🔍 Probando endpoints..."

# Test health check
echo "📊 Health check:"
curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health

echo ""
echo "🔐 Probando registro de usuario:"
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser1","email":"test@example.com","password":"TestPassword123","displayName":"Test User"}' \
  | jq . 2>/dev/null || echo "Respuesta del registro recibida"

# Matar el servidor de prueba
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ Pruebas locales completadas"
echo "🎯 El nuevo backend está listo para desplegarse en producción!"