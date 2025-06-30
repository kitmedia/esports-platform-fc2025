import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'

const prisma = new PrismaClient()
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

async function healthCheck() {
  const checks = {
    database: false,
    redis: false,
    server: false
  }

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
    console.log('✅ Database connection: OK')
  } catch (error) {
    console.error('❌ Database connection: FAILED', error)
  }

  try {
    // Check Redis connection
    await redis.connect()
    await redis.ping()
    checks.redis = true
    console.log('✅ Redis connection: OK')
    await redis.disconnect()
  } catch (error) {
    console.error('❌ Redis connection: FAILED', error)
  }

  try {
    // Check if server is responding
    const response = await fetch('http://localhost:3001/api/health')
    if (response.ok) {
      checks.server = true
      console.log('✅ Server health: OK')
    }
  } catch (error) {
    console.error('❌ Server health: FAILED', error)
  }

  // Exit with non-zero code if any check fails
  const allHealthy = Object.values(checks).every(check => check === true)
  
  if (allHealthy) {
    console.log('🎉 All health checks passed')
    process.exit(0)
  } else {
    console.log('💥 Some health checks failed')
    process.exit(1)
  }
}

// Run health check
healthCheck()
  .catch((error) => {
    console.error('Health check error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })