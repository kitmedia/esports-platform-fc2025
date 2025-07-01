# 🚨 Diagnóstico del Servidor de Producción

## Comandos para Diagnosticar

### 1. Ver qué servicios están corriendo
```bash
docker-compose ps
docker ps -a
```

### 2. Ver logs de los contenedores
```bash
docker-compose logs backend
docker-compose logs postgres
docker-compose logs redis
```

### 3. Verificar conectividad
```bash
curl http://localhost:3001/health
curl http://164.92.239.38:3001/health
netstat -tlnp | grep 3001
```

### 4. Ver procesos corriendo
```bash
ps aux | grep node
ps aux | grep docker
```

### 5. Verificar archivos
```bash
ls -la backend/
cat backend/package.json
```

## Solución Rápida - Restaurar Estado Anterior

Si nada funciona, ejecuta:

```bash
# Parar todo
docker-compose down
docker system prune -f

# Usar el docker-compose original
docker-compose up -d

# Si eso no funciona, restaurar manualmente:
cd backend
npm install
npm start &
```

## Ejecuta estos comandos y pega aquí los resultados