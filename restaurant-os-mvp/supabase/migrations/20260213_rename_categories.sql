-- Rename 'MainCourse-Veg' to 'Veg Curries'
UPDATE categories
SET name = 'Veg Curries', slug = 'veg-curries'
WHERE name = 'MainCourse-Veg' OR name = 'Main Course - Veg' OR slug = 'maincourse-veg';

-- Rename 'MainCourse-NonVeg' to 'Non-Veg Curries'
UPDATE categories
SET name = 'Non-Veg Curries', slug = 'non-veg-curries'
WHERE name = 'MainCourse-NonVeg' OR name = 'Main Course - Non Veg' OR slug = 'maincourse-nonveg';
