import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../server/utils/auth.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  const testPassword = await hashPassword('Test1234!');
  
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@test.com',
        username: 'admin',
        password: testPassword,
        nickname: 'Admin',
        bio: 'System administrator',
        provider: 'LOCAL'
      }
    }),
    prisma.user.create({
      data: {
        email: 'player1@test.com',
        username: 'player1',
        password: testPassword,
        nickname: 'Player One',
        bio: 'Test player account',
        provider: 'LOCAL'
      }
    }),
    prisma.user.create({
      data: {
        email: 'player2@test.com',
        username: 'player2',
        password: testPassword,
        nickname: 'Player Two',
        bio: 'Another test player',
        provider: 'LOCAL'
      }
    })
  ]);

  console.log(`✅ Created ${users.length} test users`);

  // Create achievements
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        code: 'FIRST_WIN',
        name: 'First Victory',
        description: 'Win your first game',
        icon: '🏆',
        points: 10,
        category: 'gameplay',
        requirement: { type: 'wins', count: 1 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'CONFESSION_MASTER',
        name: 'Confession Master',
        description: 'Have 10 confessions revealed',
        icon: '🎭',
        points: 25,
        category: 'social',
        requirement: { type: 'confessions_revealed', count: 10 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'WORD_WIZARD',
        name: 'Word Wizard',
        description: 'Score 50+ points in Word Battle',
        icon: '📝',
        points: 20,
        category: 'word_battle',
        requirement: { type: 'word_battle_score', min: 50 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'ARTIST',
        name: 'Artist',
        description: 'Win 5 Drawing Guess games',
        icon: '🎨',
        points: 30,
        category: 'drawing_guess',
        requirement: { type: 'drawing_wins', count: 5 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'SPEED_DEMON',
        name: 'Speed Demon',
        description: 'Win Racing 3D in under 30 seconds',
        icon: '🏎️',
        points: 15,
        category: 'racing',
        requirement: { type: 'racing_time', max: 30 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'SOCIAL_BUTTERFLY',
        name: 'Social Butterfly',
        description: 'Play with 20 different players',
        icon: '🦋',
        points: 20,
        category: 'social',
        requirement: { type: 'unique_opponents', count: 20 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'WINNING_STREAK',
        name: 'Winning Streak',
        description: 'Win 5 games in a row',
        icon: '🔥',
        points: 35,
        category: 'gameplay',
        requirement: { type: 'win_streak', count: 5 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'ROOM_CREATOR',
        name: 'Room Creator',
        description: 'Create 10 game rooms',
        icon: '🏠',
        points: 15,
        category: 'social',
        requirement: { type: 'rooms_created', count: 10 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'VETERAN',
        name: 'Veteran Player',
        description: 'Play 100 games',
        icon: '⭐',
        points: 50,
        category: 'gameplay',
        requirement: { type: 'total_games', count: 100 }
      }
    }),
    prisma.achievement.create({
      data: {
        code: 'PERFECT_GAME',
        name: 'Perfect Game',
        description: 'Win a game without losing a single round',
        icon: '💯',
        points: 40,
        category: 'gameplay',
        requirement: { type: 'perfect_win', value: true }
      }
    })
  ]);

  console.log(`✅ Created ${achievements.length} achievements`);

  // Create a test room
  const room = await prisma.room.create({
    data: {
      code: 'TEST01',
      name: 'Test Room',
      description: 'A test room for development',
      maxPlayers: 8,
      isPublic: true,
      creatorId: users[0].id,
      settings: {
        autoStart: false,
        minPlayers: 2,
        roundDuration: 90
      }
    }
  });

  console.log(`✅ Created test room: ${room.code}`);

  // Add players to room
  await Promise.all([
    prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: users[0].id,
        isWaiting: true
      }
    }),
    prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: users[1].id,
        isWaiting: true
      }
    })
  ]);

  console.log('✅ Added players to test room');

  // Create sample confessions
  const confessions = await Promise.all([
    prisma.confession.create({
      data: {
        roomId: room.id,
        userId: users[0].id,
        text: 'I once ate an entire pizza by myself and told everyone I shared it',
        isRevealed: false
      }
    }),
    prisma.confession.create({
      data: {
        roomId: room.id,
        userId: users[1].id,
        text: 'I pretend to be bad at video games so my friends feel better',
        isRevealed: false
      }
    })
  ]);

  console.log(`✅ Created ${confessions.length} sample confessions`);

  // Create sample chat messages
  await Promise.all([
    prisma.chatMessage.create({
      data: {
        roomId: room.id,
        userId: users[0].id,
        nickname: users[0].nickname,
        text: 'Welcome to the test room!',
        type: 'CHAT'
      }
    }),
    prisma.chatMessage.create({
      data: {
        roomId: room.id,
        nickname: 'System',
        text: 'Room created',
        type: 'SYSTEM',
        isSystem: true
      }
    })
  ]);

  console.log('✅ Created sample chat messages');

  // Create a completed game for stats
  const game = await prisma.game.create({
    data: {
      roomId: room.id,
      type: 'WORD_BATTLE',
      state: {
        completed: true,
        finalScores: {
          [users[0].id]: 45,
          [users[1].id]: 38,
          [users[2].id]: 22
        }
      },
      players: [users[0].id, users[1].id, users[2].id],
      winnerId: users[0].id,
      rankings: [
        { position: 1, userId: users[0].id, score: 45 },
        { position: 2, userId: users[1].id, score: 38 },
        { position: 3, userId: users[2].id, score: 22 }
      ],
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      endedAt: new Date(),
      duration: 300 // 5 minutes
    }
  });

  // Create game stats
  await Promise.all([
    prisma.gameStat.create({
      data: {
        gameId: game.id,
        userId: users[0].id,
        score: 45,
        position: 1,
        wins: 1,
        losses: 0,
        customStats: { wordsFound: 12, longestWord: 'computer' }
      }
    }),
    prisma.gameStat.create({
      data: {
        gameId: game.id,
        userId: users[1].id,
        score: 38,
        position: 2,
        wins: 0,
        losses: 0,
        customStats: { wordsFound: 10, longestWord: 'science' }
      }
    }),
    prisma.gameStat.create({
      data: {
        gameId: game.id,
        userId: users[2].id,
        score: 22,
        position: 3,
        wins: 0,
        losses: 1,
        customStats: { wordsFound: 6, longestWord: 'table' }
      }
    })
  ]);

  console.log('✅ Created sample game with stats');

  // Grant some achievements
  await Promise.all([
    prisma.userAchievement.create({
      data: {
        userId: users[0].id,
        achievementId: achievements[0].id, // FIRST_WIN
        progress: 100
      }
    }),
    prisma.userAchievement.create({
      data: {
        userId: users[0].id,
        achievementId: achievements[2].id, // WORD_WIZARD
        progress: 100
      }
    })
  ]);

  console.log('✅ Granted sample achievements');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });