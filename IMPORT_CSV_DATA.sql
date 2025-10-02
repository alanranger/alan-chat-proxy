-- IMPORT CSV DATA INTO DATABASE
-- This script imports the real data from CSV files into the database

-- STEP 1: CLEAR EXISTING CSV DATA
DELETE FROM csv_events_data;

-- STEP 2: INSERT BEGinners Photography Lessons CSV DATA
-- Note: This would need to be run with actual CSV data import
-- For now, showing the structure

INSERT INTO csv_events_data (
  event_title, start_date, start_time, end_date, end_time, 
  category, tags, excerpt, location_business_name, location_address, 
  location_city_state_zip, event_url, event_image, text_block, 
  published_date, workflow_state
) VALUES
-- Example from the CSV file:
('Camera Courses For Beginners - Week 1 of 3 - Coventry Oct', 
 '2025-10-02', '19:00:00', '2025-10-02', '21:00:00',
 'beginners-courses,beginners-photography,courses-near-me,enrol-date,location-coventry',
 'camera-settings,composition,exposure,photo-critiques,dslr-settings,Week-1',
 '02/10/2025Coventry - 3-week camera courses for beginners - Everything to get off Automatic mode and learn how to be more creative with Composition and Camera',
 'Coventry',
 '45 Hathaway Road, Coventry, England, CV4 9HW, United Kingdom',
 'CV4 9HW',
 'https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-oct1',
 'https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/1629536412755-A3NEF7ZNBOQ1044I8WVM/beginners-photography-courses.jpg',
 '',
 '2025-04-02 16:03:24',
 'Published'
),
-- RPS Course example:
('RPS Courses - RPS Distinctions Course - Enrol Anytime -15-10', 
 '2025-10-15', '19:00:00', '2025-10-15', '21:00:00',
 'rps-classes,location-online',
 'composition,lightroom,photo-critiques,photo-editing,photoshop,rps',
 '15/10/2025RPS Courses - RPS Distinctions - Enrol Anytime - Online Mentoring sessions to gain a distinction with the Royal Photographic Society via Zoom',
 'Online - Virtual Class - Zoom Meeting',
 'United Kingdom',
 '',
 'https://www.alanranger.com/beginners-photography-lessons/rps-courses-rps-distinctions-mentoring-2',
 'https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/1685445150893-KNP35P159NIWH07BZSXM/RPS-Distinctions-photography-course.jpg',
 '',
 '2025-07-30 09:59:53',
 'Published'
);

-- STEP 3: INSERT WORKSHOP DATA
INSERT INTO csv_events_data (
  event_title, start_date, start_time, end_date, end_time, 
  category, tags, excerpt, location_business_name, location_address, 
  location_city_state_zip, event_url, event_image, text_block, 
  published_date, workflow_state
) VALUES
-- Fairy Glen example from CSV:
('Fairy Glen Betws-y-Coed Photography Workshops - Wales - Oct', 
 '2025-10-04', '10:00:00', '2025-10-04', '13:30:00',
 '2.5hrs-4hrs',
 'wales',
 '09/05/2025Fairy Glen Betws-y-Coed Photography Workshop - A magical serene gorge through the river Conwy provides a great opportunity to practise long exposure',
 'Snowdonia National Park',
 'Betws-y-Coed, Wales, LL24 0SG, United Kingdom',
 'LL24 0SG',
 'https://www.alanranger.com/photographic-workshops-near-me/fairy-glen-photography-wales',
 'https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/1740502341422-AGUUE085W47A3L7137NG/Fairy+Glen+4.jpg',
 '',
 '2025-05-14 10:46:53',
 'Published'
);

-- STEP 4: VERIFY THE DATA
SELECT 
  'CSV Import Verification' as analysis_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN start_time IS NOT NULL THEN 1 END) as with_times,
  COUNT(CASE WHEN location_address IS NOT NULL THEN 1 END) as with_locations,
  COUNT(CASE WHEN event_url IS NOT NULL THEN 1 END) as with_urls
FROM csv_events_data;

-- STEP 5: SHOW SPECIFIC EXAMPLES
SELECT 
  event_title,
  start_date,
  start_time,
  end_time,
  location_address,
  event_url
FROM csv_events_data
WHERE event_url ILIKE '%fairy-glen%' OR event_url ILIKE '%camera-courses%'
ORDER BY start_date;


