-- Preserve existing listings while replacing broad legacy categories.
UPDATE companies SET category=CASE category
 WHEN 'AI' THEN 'AI Agents & Infrastructure'
 WHEN 'Developer tools' THEN 'Developer Tools'
 WHEN 'Productivity' THEN 'Productivity & Personal Tools'
 WHEN 'Design' THEN 'Design & Creative'
 WHEN 'SaaS' THEN 'Business, Finance & Legal'
 WHEN 'Consumer' THEN 'Other'
 ELSE category END
WHERE category IN ('AI','Developer tools','Productivity','Design','SaaS','Consumer');
