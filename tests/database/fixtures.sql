-- Synthetic values, recreated inside a rolled-back transaction for every test.
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
INSERT INTO app_private.profiles(id, display_name) SELECT id, 'Test' FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO app_private.account_states(profile_id) SELECT id FROM auth.users ON CONFLICT (profile_id) DO NOTHING;
INSERT INTO app_private.user_preferences(profile_id) SELECT id FROM auth.users ON CONFLICT (profile_id) DO NOTHING;
INSERT INTO app_private.ingredient_categories(id, slug, name)
 VALUES ('10000000-0000-4000-8000-000000000001', 'test', 'Test');
INSERT INTO app_private.ingredients(id, slug, name, category_id) VALUES
 ('10000000-0000-4000-8000-000000000002', 'test-rice', 'Test rice', '10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000003', 'test-oats', 'Test oats', NULL);
INSERT INTO app_private.tags(id, slug, name, kind)
 VALUES ('10000000-0000-4000-8000-000000000004', 'test-tag', 'Test tag', 'general');
INSERT INTO app_private.data_sources(id, code, name)
 VALUES ('10000000-0000-4000-8000-000000000005', 'test', 'Synthetic test source');
INSERT INTO app_private.recipes(id, slug, author_profile_id) VALUES
 ('20000000-0000-4000-8000-000000000001', 'test-published', '00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002', 'test-draft', '00000000-0000-4000-8000-000000000001');
INSERT INTO app_private.recipe_versions(id, recipe_id, version_number, title, difficulty, active_minutes, total_minutes) VALUES
 ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Published fixture', 'easy', 5, 10),
 ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1, 'Draft fixture', 'easy', 5, 10);
INSERT INTO app_private.recipe_servings(recipe_version_id, base_servings)
 VALUES ('21000000-0000-4000-8000-000000000001', 2);
INSERT INTO app_private.recipe_ingredients(recipe_version_id, ingredient_id, quantity, unit_id, position)
 SELECT '21000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 100, id, 1
 FROM app_private.units WHERE code = 'g';
INSERT INTO app_private.recipe_steps(recipe_version_id, step_number, instruction)
 VALUES ('21000000-0000-4000-8000-000000000001', 1, 'Synthetic instruction.');
UPDATE app_private.recipe_versions SET status = 'published' WHERE id = '21000000-0000-4000-8000-000000000001';
UPDATE app_private.recipes SET status = 'published', current_version_id = '21000000-0000-4000-8000-000000000001'
 WHERE id = '20000000-0000-4000-8000-000000000001';
INSERT INTO app_private.pantry_items(id, owner_id, ingredient_id, quantity, unit_id)
 SELECT '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002', 50, id FROM app_private.units WHERE code = 'g';
INSERT INTO app_private.meal_plans(id, owner_id, starts_on) VALUES
 ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-11-02'),
 ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '2026-11-02');
INSERT INTO app_private.meal_plan_entries(id, owner_id, meal_plan_id, recipe_version_id, planned_on, meal_slot, servings)
 VALUES ('41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '2026-11-02', 'dinner', 2);
INSERT INTO app_private.shopping_lists(id, owner_id) VALUES
 ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');
INSERT INTO app_private.shopping_list_items(id, owner_id, shopping_list_id, ingredient_id, label, origin)
 VALUES ('51000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Test rice', 'derived');
INSERT INTO app_private.shopping_list_item_sources(shopping_list_item_id, meal_plan_entry_id, owner_id)
 VALUES ('51000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
