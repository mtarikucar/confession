-- Drop database if exists (be careful!)
-- DROP DATABASE IF EXISTS confession_game;

-- Create database
CREATE DATABASE confession_game
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'English_United States.1252'
    LC_CTYPE = 'English_United States.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Grant privileges
GRANT ALL ON DATABASE confession_game TO postgres;

\echo 'Database confession_game created successfully!'