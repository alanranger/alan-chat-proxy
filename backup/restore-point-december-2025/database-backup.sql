-- DATABASE BACKUP - December 2025 Restore Point
-- Working State: Courses & Workshops Complete

-- Backup critical product records with correct values
-- These queries can be used to restore the working state if needed

-- 1. Beginners Photography Course - Correct Values
UPDATE page_entities 
SET 
  location_address = '45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW',
  time_schedule = '19:00 - 21:00',
  course_duration = '3 weeks',
  participants = '4',
  equipment_needed = 'You will need a DSLR or Mirrorless Camera with manual exposure modes.Alan will provide you with a course book covering all the topics for the course',
  experience_level = 'Beginner and Novice'
WHERE title ILIKE '%beginners photography course%' 
  AND kind = 'product';

-- 2. Lightroom Course - Correct Values  
UPDATE page_entities 
SET 
  location_address = '45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW',
  time_schedule = '19:00 - 21:00',
  course_duration = '3 weeks',
  participants = '3',
  equipment_needed = 'You will need a laptop with Adobe Lightroom Classic subscription and the App installedAlan will provide you with training Lightroom Library with images and use that to explain and then demonstrate the various tools',
  experience_level = 'Beginners'
WHERE title ILIKE '%lightroom courses for beginners%' 
  AND kind = 'product';

-- 3. Verify the backup worked
SELECT 
  title,
  location_address,
  time_schedule,
  course_duration,
  participants,
  experience_level,
  equipment_needed
FROM page_entities 
WHERE kind = 'product' 
  AND (title ILIKE '%beginners photography course%' OR title ILIKE '%lightroom courses for beginners%')
ORDER BY title;

-- 4. Check for any remaining "milliseconds" issues
SELECT 
  title,
  time_schedule,
  course_duration
FROM page_entities 
WHERE kind = 'product' 
  AND (time_schedule LIKE '%milliseconds%' OR course_duration LIKE '%milliseconds%');

-- 5. Check for any remaining over-captured location addresses
SELECT 
  title,
  location_address
FROM page_entities 
WHERE kind = 'product' 
  AND location_address LIKE '%Participants:%';

-- Expected Results:
-- Query 3: Should show clean values for both courses
-- Query 4: Should return 0 rows (no milliseconds issues)
-- Query 5: Should return 0 rows (no over-captured addresses)

