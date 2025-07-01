# 🔧 Configuración MCP para Acceso Directo al Servidor

## Qué es MCP
Model Context Protocol permite que Claude acceda directamente al servidor de producción, ejecutando comandos y viendo resultados en tiempo real.

## Beneficios
- ✅ Depuración instantánea
- ✅ Despliegue automático
- ✅ Logs en tiempo real
- ✅ No más "copia y pega" comandos

## Configuración

### 1. En el servidor de producción (164.92.239.38):

```bash
# Instalar MCP server
npm install -g @modelcontextprotocol/server-ssh

# Crear configuración
mkdir -p ~/.config/mcp
cat > ~/.config/mcp/config.json << 'EOF'
{
  "servers": {
    "ssh": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-ssh"],
      "env": {
        "SSH_HOST": "164.92.239.38",
        "SSH_USER": "root",
        "SSH_KEY_PATH": "/root/esports-platform-fc2025/sshkey"
      }
    }
  }
}
EOF
```

### 2. En Claude (tu cliente):
- Configurar MCP client con SSH access
- Apuntar a 164.92.239.38 con clave SSH

### 3. Verificación:
Una vez configurado, Claude podrá:
- Ejecutar `ps aux | grep node` directamente
- Ver `docker-compose logs` en tiempo real
- Reiniciar servicios automáticamente
- Depurar errores al instante

## Configuración Simplificada

Si prefieres algo más simple, también puedes:

1. **Dar acceso SSH** a Claude temporalmente
2. **Usar webhook** para comandos específicos
3. **API REST** para operaciones del servidor

¿Prefieres configurar MCP completo o una solución más simple?