-- Create public.get_homepage_config RPC function to aggregate homepage resources
CREATE OR REPLACE FUNCTION public.get_homepage_config(p_restaurant_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_theme RECORD;
  v_sections JSONB;
  v_banners JSONB;
  v_services JSONB;
  v_categories JSONB;
  v_specials JSONB;
  v_combos JSONB;
  v_offers JSONB;
  v_section_styles JSONB;
BEGIN
  -- 1. Fetch profile
  SELECT row_to_json(p) INTO v_profile
  FROM public.restaurant_profile p
  WHERE p.restaurant_id = p_restaurant_id;

  -- 2. Fetch theme
  SELECT row_to_json(t) INTO v_theme
  FROM public.restaurant_theme t
  WHERE t.restaurant_id = p_restaurant_id;

  -- 3. Fetch sections
  SELECT jsonb_agg(s ORDER BY s.display_order ASC) INTO v_sections
  FROM public.homepage_sections s
  WHERE s.restaurant_id = p_restaurant_id;

  -- 4. Fetch banners
  SELECT jsonb_agg(b ORDER BY b.display_order ASC) INTO v_banners
  FROM public.homepage_banners b
  WHERE b.restaurant_id = p_restaurant_id;

  -- 5. Fetch services (with fallback to service_options)
  SELECT jsonb_agg(srv ORDER BY srv.display_order ASC) INTO v_services
  FROM public.homepage_services srv
  WHERE srv.restaurant_id = p_restaurant_id;

  IF v_services IS NULL OR jsonb_array_length(v_services) = 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', opt.id::text,
      'restaurant_id', p_restaurant_id,
      'service_title', opt.label,
      'service_subtitle', '',
      'active', opt.is_active,
      'service_image', opt.image_url,
      'service_icon', opt.service_key,
      'service_key', opt.service_key,
      'display_order', opt.sort_order
    ) ORDER BY opt.sort_order ASC) INTO v_services
    FROM public.service_options opt
    WHERE opt.restaurant_id = p_restaurant_id AND opt.is_active = true;
  END IF;

  -- 6. Fetch categories (with fallback to categories table)
  SELECT jsonb_agg(c ORDER BY c.order_index ASC) INTO v_categories
  FROM public.homepage_categories c
  WHERE c.restaurant_id = p_restaurant_id;

  IF v_categories IS NULL OR jsonb_array_length(v_categories) = 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', cat.id::text,
      'restaurant_id', p_restaurant_id,
      'name', cat.name,
      'image_url', cat.image_url,
      'active', cat.is_active,
      'order_index', 0,
      'link', cat.id::text
    )) INTO v_categories
    FROM public.categories cat
    WHERE cat.restaurant_id = p_restaurant_id AND cat.is_active = true;
  END IF;

  -- 7. Fetch specials (menu items marked as today special)
  SELECT jsonb_agg(jsonb_build_object(
    'id', mi.id,
    'restaurant_id', mi.restaurant_id,
    'title', mi.name,
    'description', COALESCE(mi.description, ''),
    'price', CASE WHEN mi.special_price IS NOT NULL AND (mi.special_expiry_datetime IS NULL OR mi.special_expiry_datetime > now()) THEN mi.special_price ELSE mi.price END,
    'original_price', mi.price,
    'image_url', COALESCE(mi.image_url, ''),
    'active', (mi.active AND (mi.special_expiry_datetime IS NULL OR mi.special_expiry_datetime > now())),
    'special_type', 'single',
    'is_today_special', true,
    'special_price', mi.special_price,
    'special_expiry_datetime', mi.special_expiry_datetime,
    'items', jsonb_build_array(jsonb_build_object(
      'menu_item', jsonb_build_object(
        'id', mi.id,
        'name', mi.name,
        'price', mi.price,
        'image_url', COALESCE(mi.image_url, ''),
        'is_available', mi.is_available,
        'active', mi.active,
        'description', COALESCE(mi.description, '')
      ),
      'quantity', 1,
      'price', mi.price
    )),
    'expiry_datetime', mi.special_expiry_datetime,
    'display_order', COALESCE(mi.sort_order, 0)
  ) ORDER BY mi.sort_order ASC) INTO v_specials
  FROM public.menu_items mi
  WHERE mi.restaurant_id = p_restaurant_id AND mi.is_today_special = true;

  -- 8. Fetch combos
  SELECT jsonb_agg(jsonb_build_object(
    'id', ts.id,
    'restaurant_id', ts.restaurant_id,
    'title', ts.title,
    'description', COALESCE(ts.description, ''),
    'price', COALESCE(ts.special_price, ts.original_price, 0),
    'image_url', COALESCE(ts.image_url, ''),
    'active', ts.is_active,
    'special_type', 'combo',
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tsi.id,
        'special_id', tsi.today_special_id,
        'menu_item_id', tsi.menu_item_id,
        'quantity', tsi.quantity,
        'menu_item', jsonb_build_object(
          'id', mi.id,
          'name', mi.name,
          'price', mi.price,
          'image_url', COALESCE(mi.image_url, ''),
          'is_available', mi.is_available,
          'active', mi.active,
          'description', COALESCE(mi.description, '')
        )
      ))
      FROM public.today_special_items tsi
      LEFT JOIN public.menu_items mi ON mi.id = tsi.menu_item_id
      WHERE tsi.today_special_id = ts.id
    ), '[]'::jsonb),
    'expiry_datetime', ts.valid_to,
    'display_order', 0
  )) INTO v_combos
  FROM public.today_specials ts
  WHERE ts.restaurant_id = p_restaurant_id AND (ts.special_type = 'combo' OR ts.is_combo = true);

  -- 9. Fetch offers
  SELECT jsonb_agg(o ORDER BY o.created_at DESC) INTO v_offers
  FROM public.offers o
  WHERE o.restaurant_id = p_restaurant_id;

  -- 10. Fetch section style settings
  SELECT jsonb_agg(st) INTO v_section_styles
  FROM public.section_style_settings st
  WHERE st.restaurant_id = p_restaurant_id;

  -- Return combined JSONB
  RETURN jsonb_build_object(
    'profile', COALESCE(to_jsonb(v_profile), '{}'::jsonb),
    'theme', COALESCE(to_jsonb(v_theme), '{}'::jsonb),
    'sections', COALESCE(v_sections, '[]'::jsonb),
    'banners', COALESCE(v_banners, '[]'::jsonb),
    'services', COALESCE(v_services, '[]'::jsonb),
    'categories', COALESCE(v_categories, '[]'::jsonb),
    'specials', COALESCE(v_specials, '[]'::jsonb),
    'combos', COALESCE(v_combos, '[]'::jsonb),
    'offers', COALESCE(v_offers, '[]'::jsonb),
    'section_styles', COALESCE(v_section_styles, '[]'::jsonb)
  );
END;
$$;
