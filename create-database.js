import pg from 'pg';
const { Client } = pg;

async function createDatabase() {
  // First connect to postgres database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if database exists
    const checkDB = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'confession_game'"
    );

    if (checkDB.rows.length === 0) {
      // Create database with template0 to avoid collation issues
      await client.query(`
        CREATE DATABASE confession_game 
        WITH TEMPLATE = template0 
        ENCODING = 'UTF8' 
        LC_COLLATE = 'C' 
        LC_CTYPE = 'C'
      `);
      console.log('✅ Database "confession_game" created successfully!');
    } else {
      console.log('ℹ️ Database "confession_game" already exists');
    }

    await client.end();
    console.log('Disconnected from PostgreSQL');
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

createDatabase();