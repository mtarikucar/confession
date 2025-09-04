-- Add TRUTH_OR_DARE to GameType enum
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'TRUTH_OR_DARE';

-- Remove old game types (optional - only if you want to clean up)
-- Note: This might fail if there are existing records with these values
-- ALTER TYPE "GameType" DROP VALUE IF EXISTS 'RACING_3D';
-- ALTER TYPE "GameType" DROP VALUE IF EXISTS 'TURBO_LEGENDS';