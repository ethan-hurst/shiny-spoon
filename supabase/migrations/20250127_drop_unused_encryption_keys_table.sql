-- Drop unused encryption_keys table
-- This table was created but never actually used.
-- The encryption functions use app.encryption_key setting instead.
DROP TABLE IF EXISTS encryption_keys CASCADE;