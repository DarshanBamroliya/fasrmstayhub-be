-- Migration to make farmhouseId and address nullable in locations table
-- Run this SQL script in your database

ALTER TABLE locations 
MODIFY COLUMN farmhouseId INT NULL;

ALTER TABLE locations 
MODIFY COLUMN address TEXT NULL;
