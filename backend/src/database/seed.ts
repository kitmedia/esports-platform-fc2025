import { PrismaClient, UserRole, TournamentStatus, GameMode, MatchStatus } from '@prisma/client'
import bcryptjs from 'bcryptjs'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create admin user
  const adminPassword = await bcryptjs.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@esports.com' },
    update: {},
    create: {
      id: 'admin-user-id',
      email: 'admin@esports.com',
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      password: adminPassword,
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      settings: {
        notifications: true,
        publicProfile: true,
        showStats: true,
        language: 'en',
        timezone: 'UTC',
        theme: 'dark'
      },
      profile: {
        bio: 'System Administrator',
        country: 'US',
        socialLinks: {},
        achievements: []
      }
    }
  })

  // Create test users
  const users = []
  for (let i = 0; i < 20; i++) {
    const password = await bcryptjs.hash('password123', 12)
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        username: faker.internet.userName(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        password,
        role: faker.helpers.arrayElement([UserRole.PLAYER, UserRole.ORGANIZER]),
        isVerified: true,
        settings: {
          notifications: faker.datatype.boolean(),
          publicProfile: faker.datatype.boolean(),
          showStats: faker.datatype.boolean(),
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
          timezone: faker.location.timeZone(),
          theme: faker.helpers.arrayElement(['light', 'dark', 'system'])
        },
        profile: {
          bio: faker.lorem.sentence(),
          country: faker.location.countryCode(),
          avatar: faker.image.avatar(),
          socialLinks: {
            twitter: faker.internet.userName(),
            discord: faker.internet.userName(),
            twitch: faker.internet.userName()
          },
          achievements: []
        },
        stats: {
          matchesPlayed: faker.number.int({ min: 0, max: 100 }),
          matchesWon: faker.number.int({ min: 0, max: 50 }),
          tournamentsPlayed: faker.number.int({ min: 0, max: 20 }),
          tournamentsWon: faker.number.int({ min: 0, max: 5 }),
          totalEarnings: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
          currentStreak: faker.number.int({ min: 0, max: 10 }),
          longestStreak: faker.number.int({ min: 0, max: 15 }),
          averagePerformance: faker.number.float({ min: 0, max: 100, fractionDigits: 2 })
        }
      }
    })
    users.push(user)
  }

  // Create teams
  const teams = []
  for (let i = 0; i < 10; i++) {
    const teamMembers = faker.helpers.arrayElements(users, { min: 2, max: 5 })
    const captain = teamMembers[0]
    
    const team = await prisma.team.create({
      data: {
        name: `${faker.company.name()} ${faker.helpers.arrayElement(['Esports', 'Gaming', 'FC', 'United', 'Lions', 'Eagles'])}`,
        description: faker.lorem.paragraph(),
        logo: faker.image.url(),
        captainId: captain.id,
        isPublic: faker.datatype.boolean(),
        settings: {
          allowInvites: faker.datatype.boolean(),
          requireApproval: faker.datatype.boolean(),
          maxMembers: faker.number.int({ min: 5, max: 20 })
        },
        members: {
          connect: teamMembers.map(user => ({ id: user.id }))
        }
      }
    })
    teams.push(team)
  }

  // Create tournaments
  const tournaments = []
  for (let i = 0; i < 5; i++) {
    const organizer = faker.helpers.arrayElement(users.filter(u => u.role === UserRole.ORGANIZER))
    const startDate = faker.date.future()
    
    const tournament = await prisma.tournament.create({
      data: {
        title: `${faker.helpers.arrayElement(['FIFA', 'FC', 'Ultimate', 'Champions', 'Pro'])} ${faker.helpers.arrayElement(['Cup', 'League', 'Tournament', 'Championship'])} ${faker.date.recent().getFullYear()}`,
        description: faker.lorem.paragraphs(2),
        gameMode: faker.helpers.arrayElement(Object.values(GameMode)),
        maxParticipants: faker.helpers.arrayElement([8, 16, 32, 64]),
        entryFee: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
        prizePool: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
        startDate,
        endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days later
        registrationDeadline: new Date(startDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        status: faker.helpers.arrayElement(Object.values(TournamentStatus)),
        organizerId: organizer.id,
        isPublic: true,
        rules: {
          format: faker.helpers.arrayElement(['single-elimination', 'double-elimination', 'round-robin']),
          matchDuration: faker.number.int({ min: 10, max: 90 }),
          overtimeRules: faker.lorem.sentence(),
          substitutionRules: faker.lorem.sentence()
        },
        settings: {
          allowLateRegistration: faker.datatype.boolean(),
          requireTeamVerification: faker.datatype.boolean(),
          enableStreaming: faker.datatype.boolean(),
          enableChat: faker.datatype.boolean()
        },
        brackets: {
          structure: 'single-elimination',
          rounds: [],
          currentRound: 1
        }
      }
    })
    tournaments.push(tournament)

    // Add participants to tournaments
    const participants = faker.helpers.arrayElements(users, { min: 4, max: tournament.maxParticipants })
    for (const participant of participants) {
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          userId: participant.id,
          registeredAt: faker.date.past(),
          isCheckedIn: faker.datatype.boolean(),
          seed: participants.indexOf(participant) + 1
        }
      })
    }
  }

  // Create matches
  for (const tournament of tournaments) {
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      include: { user: true }
    })

    if (participants.length >= 2) {
      for (let i = 0; i < Math.min(5, Math.floor(participants.length / 2)); i++) {
        const player1 = participants[i * 2]
        const player2 = participants[i * 2 + 1] || participants[0]

        const match = await prisma.match.create({
          data: {
            tournamentId: tournament.id,
            player1Id: player1.userId,
            player2Id: player2.userId,
            scheduledAt: faker.date.future(),
            status: faker.helpers.arrayElement(Object.values(MatchStatus)),
            round: 1,
            bracketPosition: i + 1,
            settings: {
              duration: faker.number.int({ min: 10, max: 90 }),
              overtime: faker.datatype.boolean(),
              penalties: faker.datatype.boolean()
            }
          }
        })

        // Add match results for completed matches
        if (match.status === MatchStatus.COMPLETED) {
          const player1Score = faker.number.int({ min: 0, max: 5 })
          const player2Score = faker.number.int({ min: 0, max: 5 })
          const winnerId = player1Score > player2Score ? player1.userId : 
                          player2Score > player1Score ? player2.userId : null

          await prisma.match.update({
            where: { id: match.id },
            data: {
              player1Score,
              player2Score,
              winnerId,
              startedAt: faker.date.past(),
              endedAt: faker.date.recent(),
              result: {
                duration: faker.number.int({ min: 10, max: 120 }),
                goals: [],
                cards: [],
                substitutions: [],
                statistics: {
                  possession: [faker.number.int({ min: 30, max: 70 }), faker.number.int({ min: 30, max: 70 })],
                  shots: [faker.number.int({ min: 5, max: 20 }), faker.number.int({ min: 5, max: 20 })],
                  shotsOnTarget: [faker.number.int({ min: 2, max: 10 }), faker.number.int({ min: 2, max: 10 })],
                  fouls: [faker.number.int({ min: 0, max: 15 }), faker.number.int({ min: 0, max: 15 })]
                }
              }
            }
          })
        }
      }
    }
  }

  // Create notifications
  for (const user of users.slice(0, 10)) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: faker.helpers.arrayElement(['tournament_invite', 'match_reminder', 'payment_success', 'achievement_unlocked']),
        title: faker.lorem.sentence(),
        message: faker.lorem.paragraph(),
        isRead: faker.datatype.boolean(),
        data: {
          tournamentId: faker.helpers.arrayElement(tournaments)?.id,
          actionUrl: faker.internet.url()
        }
      }
    })
  }

  // Create payment records
  for (let i = 0; i < 10; i++) {
    const user = faker.helpers.arrayElement(users)
    const tournament = faker.helpers.arrayElement(tournaments)
    
    await prisma.payment.create({
      data: {
        userId: user.id,
        tournamentId: tournament.id,
        stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
        amount: tournament.entryFee,
        currency: 'USD',
        status: faker.helpers.arrayElement(['succeeded', 'pending', 'failed']),
        description: `Entry fee for ${tournament.title}`,
        metadata: {
          tournamentId: tournament.id,
          userId: user.id
        }
      }
    })
  }

  // Create streams
  for (let i = 0; i < 3; i++) {
    const streamer = faker.helpers.arrayElement(users)
    
    await prisma.stream.create({
      data: {
        streamerId: streamer.id,
        title: `${streamer.username}'s Stream - ${faker.lorem.words(3)}`,
        description: faker.lorem.paragraph(),
        streamKey: faker.string.uuid(),
        status: faker.helpers.arrayElement(['LIVE', 'OFFLINE', 'STARTING']),
        settings: {
          quality: faker.helpers.arrayElement(['720p', '1080p', '1440p']),
          bitrate: faker.number.int({ min: 2000, max: 8000 }),
          fps: faker.helpers.arrayElement([30, 60]),
          enableChat: faker.datatype.boolean(),
          enableDonations: faker.datatype.boolean()
        },
        metrics: {
          currentViewers: faker.number.int({ min: 0, max: 1000 }),
          totalViews: faker.number.int({ min: 100, max: 50000 }),
          totalDuration: faker.number.int({ min: 3600, max: 86400 }),
          peakViewers: faker.number.int({ min: 10, max: 2000 })
        }
      }
    })
  }

  // Create Discord bot configuration
  await prisma.discordBot.upsert({
    where: { id: 'main-bot' },
    update: {},
    create: {
      id: 'main-bot',
      name: 'EA SPORTS FC 2025 Bot',
      token: 'placeholder-token',
      clientId: 'placeholder-client-id',
      guildId: 'placeholder-guild-id',
      isActive: true,
      settings: {
        commandPrefix: '!',
        enableWelcomeMessages: true,
        enableTournamentNotifications: true,
        enableMatchUpdates: true,
        moderationEnabled: true,
        autoRoleEnabled: true
      },
      channels: {
        general: 'general-channel-id',
        tournaments: 'tournaments-channel-id',
        matches: 'matches-channel-id',
        announcements: 'announcements-channel-id'
      }
    }
  })

  console.log('✅ Database seeding completed!')
  console.log(`👤 Created ${users.length} users`)
  console.log(`👥 Created ${teams.length} teams`)
  console.log(`🏆 Created ${tournaments.length} tournaments`)
  console.log(`🎮 Created matches and other data`)
  console.log(`🔑 Admin login: admin@esports.com / admin123`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })