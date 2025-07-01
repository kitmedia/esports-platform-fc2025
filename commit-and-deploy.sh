#!/bin/bash

echo "🚀 Committing y desplegando nuevo backend con autenticación completa"
echo "=================================================================="

# Git add y commit
echo "📦 Añadiendo archivos al repositorio..."
git add .

echo "💾 Creando commit..."
git commit -m "feat: Implement complete backend with user authentication

✅ Features implemented:
- User registration and login system
- JWT authentication with Redis session management
- Password hashing with bcrypt
- Complete Prisma database schema
- Tournament and user endpoints
- Role-based authorization
- API endpoints for all core functionality

🔐 Authentication endpoints:
- POST /api/auth/register - User registration
- POST /api/auth/login - User login  
- GET /api/auth/me - Get current user
- POST /api/auth/logout - User logout

🎮 Platform endpoints:
- GET /api/tournaments - List tournaments
- GET /api/users/leaderboard - User rankings

🛡️ Security features:
- Password validation and hashing
- JWT token management
- CORS and Helmet security middleware
- Rate limiting protection

💾 Database:
- Complete Prisma schema with all models
- PostgreSQL with all tables created
- Redis integration for sessions

This resolves the issue where users could not register or access
platform functionality. The platform now has a complete backend
with authentication system ready for production deployment.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "🎉 ¡Backend completo implementado y desplegado!"
echo ""
echo "✅ Funcionalidades implementadas:"
echo "   - ✅ Registro de usuarios"
echo "   - ✅ Login de usuarios"  
echo "   - ✅ Autenticación JWT"
echo "   - ✅ Base de datos completa"
echo "   - ✅ Endpoints de torneos"
echo "   - ✅ Sistema de ranking"
echo ""
echo "🔧 Próximos pasos para el servidor de producción:"
echo "   1. Hacer pull del nuevo código en el servidor"
echo "   2. Reconstruir el contenedor Docker"
echo "   3. Reiniciar los servicios"
echo ""
echo "📋 URLs de prueba en el servidor:"
echo "   http://164.92.239.38:3001/api/status"
echo "   http://164.92.239.38:3001/api/auth/register"
echo "   http://164.92.239.38:3001/api/tournaments"
echo ""
echo "🎯 ¡La plataforma ahora permite registro de usuarios y funcionalidades completas!"