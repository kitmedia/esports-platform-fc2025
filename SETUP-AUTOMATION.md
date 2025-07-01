# 🤖 Automatización con GitHub Actions

## Qué hace esto por ti

**En lugar de conectarte por SSH cada vez**, GitHub Actions:
1. ✅ Se conecta automáticamente al servidor
2. ✅ Actualiza el código
3. ✅ Reinicia los servicios
4. ✅ Verifica que funcione
5. ✅ Te notifica el resultado

## Configuración (solo una vez)

### 1. Crear secretos en GitHub
Ve a tu repositorio → **Settings** → **Secrets and variables** → **Actions**

Crear estos secretos:
- `HOST`: `164.92.239.38`
- `USERNAME`: `root`
- `SSH_KEY`: Tu clave SSH privada

### 2. Obtener tu clave SSH
En tu máquina local:
```bash
# Ver tu clave SSH (la que usas para conectarte al servidor)
cat ~/.ssh/id_rsa
```
Copia TODO el contenido y ponlo en el secreto `SSH_KEY`.

### 3. Usar la automatización

**Cada vez que hagas `git push`:**
1. GitHub Actions se ejecuta automáticamente
2. Despliega en tu servidor
3. Te dice si funcionó o falló

**Para desplegar manualmente:**
1. Ve a tu repositorio en GitHub
2. **Actions** tab
3. **Deploy to Production**
4. **Run workflow**

## Ventajas

❌ **Antes**: SSH → comandos → verificar → repetir
✅ **Ahora**: `git push` → todo automático

¡Ya no tendrás que conectarte al servidor manualmente!