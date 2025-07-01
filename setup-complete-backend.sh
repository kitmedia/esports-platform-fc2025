#!/bin/bash

echo "🚀 Configurando Backend Completo para EA SPORTS FC 2025 eSports Platform"
echo "======================================================================="

# 1. Primero, necesitamos configurar Prisma
echo "📦 Paso 1: Configurando Prisma ORM..."

cat > backend/prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User model
model User {
  id                String      @id @default(uuid())
  username          String      @unique
  email             String      @unique
  password          String
  displayName       String?
  bio               String?
  avatar            String?
  platform          Platform    @default(PC)
  platformUsername  String?
  
  rating            Int         @default(1200)
  wins              Int         @default(0)
  losses            Int         @default(0)
  draws             Int         @default(0)
  
  role              UserRole    @default(PLAYER)
  status            UserStatus  @default(ACTIVE)
  emailVerified     Boolean     @default(false)
  twoFactorEnabled  Boolean     @default(false)
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  lastLoginAt       DateTime?
  
  // Relations
  tournaments       Tournament[]
  participations    Participant[]
  teamsOwned        Team[]
  teamMemberships   TeamMember[]
  matchesAsPlayer1  Match[]     @relation("Player1Matches")
  matchesAsPlayer2  Match[]     @relation("Player2Matches")
  disputes          Dispute[]
  notifications     Notification[]
  payments          Payment[]
  streams           Stream[]
}

// Tournament model
model Tournament {
  id                String              @id @default(uuid())
  name              String
  description       String?
  format            TournamentFormat
  gameMode          GameMode
  platform          Platform
  
  maxParticipants   Int
  minParticipants   Int
  currentParticipants Int              @default(0)
  
  teamSize          Int                 @default(1)
  isTeamTournament  Boolean             @default(false)
  
  entryFee          Float               @default(0)
  prizePool         Float               @default(0)
  prizeDistribution Json?
  
  registrationStart DateTime
  registrationEnd   DateTime
  tournamentStart   DateTime
  tournamentEnd     DateTime?
  
  status            TournamentStatus    @default(DRAFT)
  visibility        TournamentVisibility @default(PUBLIC)
  requiresApproval  Boolean             @default(false)
  
  rules             String[]
  settings          Json?
  
  streamingEnabled  Boolean             @default(false)
  discordIntegration Boolean            @default(false)
  discordServerId   String?
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  // Relations
  organizer         User                @relation(fields: [organizerId], references: [id])
  organizerId       String
  participants      Participant[]
  matches           Match[]
  teams             Team[]
  bracket           Bracket?
  streams           Stream[]
}

// Match model
model Match {
  id                String          @id @default(uuid())
  matchNumber       Int
  round             Int
  
  scheduledAt       DateTime?
  startedAt         DateTime?
  completedAt       DateTime?
  
  status            MatchStatus     @default(PENDING)
  
  player1Score      Int?
  player2Score      Int?
  
  winnerId          String?
  
  resultScreenshot  String?
  resultVerified    Boolean         @default(false)
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  tournament        Tournament      @relation(fields: [tournamentId], references: [id])
  tournamentId      String
  
  player1           User?           @relation("Player1Matches", fields: [player1Id], references: [id])
  player1Id         String?
  
  player2           User?           @relation("Player2Matches", fields: [player2Id], references: [id])
  player2Id         String?
  
  disputes          Dispute[]
  stream            Stream?
}

// Team model
model Team {
  id                String          @id @default(uuid())
  name              String
  tag               String          @unique
  logo              String?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  owner             User            @relation(fields: [ownerId], references: [id])
  ownerId           String
  
  members           TeamMember[]
  tournaments       Tournament[]
  participations    Participant[]
}

// Participant model
model Participant {
  id                String          @id @default(uuid())
  
  status            ParticipantStatus @default(REGISTERED)
  seed              Int?
  finalPlacement    Int?
  
  checkedIn         Boolean         @default(false)
  checkedInAt       DateTime?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  tournament        Tournament      @relation(fields: [tournamentId], references: [id])
  tournamentId      String
  
  user              User?           @relation(fields: [userId], references: [id])
  userId            String?
  
  team              Team?           @relation(fields: [teamId], references: [id])
  teamId            String?
  
  @@unique([tournamentId, userId])
  @@unique([tournamentId, teamId])
}

// Other models...
model TeamMember {
  id                String          @id @default(uuid())
  role              TeamRole        @default(MEMBER)
  joinedAt          DateTime        @default(now())
  
  team              Team            @relation(fields: [teamId], references: [id])
  teamId            String
  user              User            @relation(fields: [userId], references: [id])
  userId            String
  
  @@unique([teamId, userId])
}

model Bracket {
  id                String          @id @default(uuid())
  structure         Json
  currentRound      Int             @default(1)
  
  tournament        Tournament      @relation(fields: [tournamentId], references: [id])
  tournamentId      String          @unique
}

model Dispute {
  id                String          @id @default(uuid())
  reason            String
  description       String
  evidence          String[]
  
  status            DisputeStatus   @default(OPEN)
  resolution        String?
  resolvedAt        DateTime?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  match             Match           @relation(fields: [matchId], references: [id])
  matchId           String
  
  reporter          User            @relation(fields: [reporterId], references: [id])
  reporterId        String
}

model Payment {
  id                String          @id @default(uuid())
  amount            Float
  currency          String          @default("USD")
  
  type              PaymentType
  status            PaymentStatus   @default(PENDING)
  
  stripePaymentId   String?
  stripeIntentId    String?
  
  processedAt       DateTime?
  failureReason     String?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  user              User            @relation(fields: [userId], references: [id])
  userId            String
}

model Stream {
  id                String          @id @default(uuid())
  title             String
  streamKey         String          @unique
  
  platform          StreamPlatform
  platformStreamId  String?
  
  isLive            Boolean         @default(false)
  viewerCount       Int             @default(0)
  
  startedAt         DateTime?
  endedAt           DateTime?
  
  vodUrl            String?
  thumbnailUrl      String?
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  // Relations
  streamer          User            @relation(fields: [streamerId], references: [id])
  streamerId        String
  
  tournament        Tournament?     @relation(fields: [tournamentId], references: [id])
  tournamentId      String?
  
  match             Match?          @relation(fields: [matchId], references: [id])
  matchId           String?         @unique
}

model Notification {
  id                String          @id @default(uuid())
  type              NotificationType
  title             String
  message           String
  
  read              Boolean         @default(false)
  readAt            DateTime?
  
  data              Json?
  
  createdAt         DateTime        @default(now())
  
  // Relations
  user              User            @relation(fields: [userId], references: [id])
  userId            String
}

// Enums
enum Platform {
  PS5
  PS4
  XBOX_SERIES
  XBOX_ONE
  PC
  SWITCH
}

enum UserRole {
  PLAYER
  ORGANIZER
  MODERATOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
}

enum TournamentFormat {
  SINGLE_ELIMINATION
  DOUBLE_ELIMINATION
  ROUND_ROBIN
  SWISS
  LEAGUE
  CUSTOM
}

enum GameMode {
  ULTIMATE_TEAM
  KICK_OFF
  CAREER_MODE
  VOLTA_FOOTBALL
  PRO_CLUBS
}

enum TournamentStatus {
  DRAFT
  PUBLISHED
  REGISTRATION_OPEN
  REGISTRATION_CLOSED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum TournamentVisibility {
  PUBLIC
  PRIVATE
  UNLISTED
}

enum MatchStatus {
  PENDING
  READY
  IN_PROGRESS
  COMPLETED
  DISPUTED
  CANCELLED
}

enum ParticipantStatus {
  REGISTERED
  CONFIRMED
  CHECKED_IN
  ELIMINATED
  WINNER
  DISQUALIFIED
}

enum TeamRole {
  OWNER
  CAPTAIN
  MEMBER
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  REJECTED
}

enum PaymentType {
  ENTRY_FEE
  PRIZE
  SUBSCRIPTION
  REFUND
}

enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

enum StreamPlatform {
  TWITCH
  YOUTUBE
  FACEBOOK
  CUSTOM
}

enum NotificationType {
  TOURNAMENT_START
  MATCH_READY
  MATCH_RESULT
  DISPUTE_UPDATE
  PAYMENT_UPDATE
  GENERAL
}
EOF

# 2. Crear el archivo .env con las variables necesarias
echo "🔧 Paso 2: Configurando variables de entorno..."
cat >> backend/.env << 'EOF'

# Añadir estas variables si no existen
DATABASE_URL=postgresql://esports_user:esports_password@postgres:5432/esports_platform
REDIS_URL=redis://:redis_password@redis:6379

# JWT
JWT_SECRET=your_super_secure_jwt_secret_min_32_characters_long_random_string_here_2024
JWT_REFRESH_SECRET=your_super_secure_refresh_jwt_secret_different_from_above_random_2024
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt
BCRYPT_ROUNDS=10

# API Keys (usar valores de prueba por ahora)
OPENAI_API_KEY=sk-test-1234567890
STRIPE_SECRET_KEY=sk_test_1234567890
DISCORD_BOT_TOKEN=test_bot_token
CLOUDINARY_URL=cloudinary://test:test@test

# Email (configurar más tarde)
EMAIL_FROM=noreply@esportsfc2025.com
EOF

echo "📝 Paso 3: Creando estructura de archivos del backend..."

# Crear directorios necesarios
mkdir -p backend/src/{config,controllers,middleware,routes,services,utils,types,validators}

echo "✅ Configuración inicial completada!"
echo ""
echo "📋 Siguientes pasos:"
echo "1. Ejecutar: cd backend && npm install"
echo "2. Ejecutar: npx prisma generate"
echo "3. Ejecutar: npx prisma migrate dev --name init"
echo "4. Reconstruir el backend con: docker-compose build backend"
echo ""
echo "⚠️  NOTA: Este es solo el inicio. Necesitaremos implementar:"
echo "   - Controladores para cada ruta"
echo "   - Servicios de autenticación"
echo "   - Middleware de validación"
echo "   - Lógica de negocio completa"