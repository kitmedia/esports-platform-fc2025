#!/bin/bash

echo "📦 Instalando dependencias en el servidor..."
echo "============================================"

# Actualizar paquetes del sistema
echo "🔄 Actualizando sistema..."
apt update -y

# Instalar Node.js y npm
echo "📗 Instalando Node.js y npm..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalación
echo "✅ Verificando Node.js:"
node --version
npm --version

# Instalar PostgreSQL
echo "🐘 Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Instalar Redis
echo "🔴 Instalando Redis..."
apt install -y redis-server

# Iniciar servicios
echo "🚀 Iniciando servicios..."
systemctl start postgresql
systemctl enable postgresql
systemctl start redis-server
systemctl enable redis-server

# Configurar PostgreSQL
echo "🔧 Configurando PostgreSQL..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"
sudo -u postgres createdb esports_db 2>/dev/null || echo "Base de datos ya existe"

# Verificar servicios
echo "🧪 Verificando servicios..."
systemctl status postgresql --no-pager -l
systemctl status redis-server --no-pager -l

echo "✅ Instalación completada!"
echo "Ahora ejecuta: ./FIX-SERVER.sh"