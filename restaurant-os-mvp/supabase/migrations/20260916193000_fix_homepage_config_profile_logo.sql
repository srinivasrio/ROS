-- Migration: Fix get_homepage_config to properly return restaurant profile and logo_url
-- PostgreSQL composite type IS NOT NULL evaluates to false if any column is null, which caused
-- v_prof IS NOT NULL to fail when opening_time or other columns were null.
-- We now select directly into JSONB and check IS NOT NULL, ensuring logo_url and all profile details
-- are returned reliably for all restaurants.

CREATE OR REPLACE FUNCTION public.get_homepage_config(p_restaurant_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved_id TEXT;
  v_profile JSONB;
  v_theme JSONB;
  v_sections JSONB;
  v_banners JSONB;
  v_services JSONB;
  v_categories JSONB;
  v_specials JSONB;
  v_combos JSONB;
  v_offers JSONB;
  v_section_styles JSONB;
  v_exists BOOLEAN;
BEGIN
  -- 0. Guard against NULL or empty input
  IF p_restaurant_id IS NULL OR trim(p_restaurant_id) = '' OR p_restaurant_id = 'null' OR p_restaurant_id = 'undefined' THEN
    RETURN jsonb_build_object(
      'profile', '{}'::jsonb,
      'theme', jsonb_build_object('bg_color', '#F9FAFB', 'primary_button_color', '#F97316'),
      'sections', '[]'::jsonb,
      'banners', '[]'::jsonb,
      'services', '[]'::jsonb,
      'categories', '[]'::jsonb,
      'specials', '[]'::jsonb,
      'combos', '[]'::jsonb,
      'offers', '[]'::jsonb,
      'section_styles', '[]'::jsonb
    );
  END IF;

  v_resolved_id := trim(p_restaurant_id);

  -- 0b. Resolve slug to actual restaurant_id if needed
  SELECT restaurant_id INTO v_resolved_id
  FROM public.restaurant_profile
  WHERE restaurant_id = v_resolved_id OR slug = lower(v_resolved_id)
  LIMIT 1;

  IF v_resolved_id IS NULL THEN
    v_resolved_id := trim(p_restaurant_id);
    SELECT id INTO v_resolved_id
    FROM public.restaurants
    WHERE id = v_resolved_id
    LIMIT 1;
    IF v_resolved_id IS NULL THEN
      v_resolved_id := trim(p_restaurant_id);
    END IF;
  END IF;

  -- Check if this restaurant exists in restaurants table
  SELECT EXISTS(SELECT 1 FROM public.restaurants WHERE id = v_resolved_id) INTO v_exists;

  -- 1. Fetch profile (merging restaurant_info into top-level jsonb)
  SELECT (to_jsonb(p) || COALESCE(p.restaurant_info, '{}'::jsonb)) INTO v_profile
  FROM public.restaurant_profile p
  WHERE p.restaurant_id = v_resolved_id;

  IF v_profile IS NULL THEN
    IF v_exists THEN
      BEGIN
        INSERT INTO public.restaurant_profile (
          restaurant_id, name, address, phone, email, slug, restaurant_info
        )
        SELECT 
          r.id,
          r.name,
          COALESCE(r.address, ''),
          COALESCE(r.phone, ''),
          COALESCE(r.email, ''),
          COALESCE(r.id, 'restaurant'),
          jsonb_build_object(
            'name', r.name,
            'address', COALESCE(r.address, ''),
            'phone', COALESCE(r.phone, ''),
            'email', COALESCE(r.email, ''),
            'logo_url', COALESCE(r.logo_url, ''),
            'operating_hours', COALESCE(r.operating_hours, '{}'::jsonb)
          )
        FROM public.restaurants r
        WHERE r.id = v_resolved_id
        ON CONFLICT (restaurant_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      -- Re-check restaurant_profile
      SELECT (to_jsonb(p) || COALESCE(p.restaurant_info, '{}'::jsonb)) INTO v_profile
      FROM public.restaurant_profile p
      WHERE p.restaurant_id = v_resolved_id;
    END IF;

    IF v_profile IS NULL THEN
      SELECT jsonb_build_object(
        'restaurant_id', v_resolved_id, 
        'name', r.name,
        'address', COALESCE(r.address, ''),
        'phone', COALESCE(r.phone, ''),
        'email', COALESCE(r.email, ''),
        'logo_url', COALESCE(r.logo_url, ''),
        'operating_hours', COALESCE(r.operating_hours, '{}'::jsonb)
      ) INTO v_profile
      FROM public.restaurants r
      WHERE r.id = v_resolved_id;
    END IF;
  END IF;

  -- 2. Fetch theme as clean JSONB
  SELECT to_jsonb(t) INTO v_theme
  FROM public.restaurant_theme t
  WHERE t.restaurant_id = v_resolved_id;

  IF v_theme IS NULL THEN
    IF v_exists THEN
      BEGIN
        INSERT INTO public.restaurant_theme (
          restaurant_id, bg_color, webpage_bg_color, header_bg_color, text_color, 
          primary_button_color, secondary_button_color, font_style, card_radius
        ) VALUES (
          v_resolved_id, '#F9FAFB', '#ffffff', '#ffffff', '#000000',
          '#F97316', '#000000', 'Inter', '16px'
        ) ON CONFLICT (restaurant_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      SELECT to_jsonb(t) INTO v_theme
      FROM public.restaurant_theme t
      WHERE t.restaurant_id = v_resolved_id;
    END IF;

    IF v_theme IS NULL THEN
      v_theme := jsonb_build_object(
        'restaurant_id', v_resolved_id,
        'bg_color', '#F9FAFB',
        'webpage_bg_color', '#ffffff',
        'header_bg_color', '#ffffff',
        'text_color', '#000000',
        'primary_button_color', '#F97316',
        'secondary_button_color', '#000000',
        'font_style', 'Inter',
        'card_radius', '16px'
      );
    END IF;
  END IF;

  -- 3. Fetch sections (with auto-seed fallback: popular at 3, categories at 4)
  SELECT jsonb_agg(s ORDER BY s.display_order ASC) INTO v_sections
  FROM public.homepage_sections s
  WHERE s.restaurant_id = v_resolved_id;

  IF v_sections IS NULL OR jsonb_array_length(v_sections) = 0 THEN
    BEGIN
      INSERT INTO public.homepage_sections (id, restaurant_id, section_type, section_title, display_order, active, layout, elements)
      VALUES
        (gen_random_uuid(), v_resolved_id, 'header', 'Header', 1, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'hero_banners', 'Hero Banners', 2, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'popular', 'Popular Items', 3, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'categories', 'Categories', 4, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'services', 'Services', 5, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'specials', 'Today Specials', 6, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'combos', 'Combo Offers', 7, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'offers', 'Coupons & Offers', 8, true, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'reorder', 'Reorder Section', 9, false, '{}'::jsonb, '[]'::jsonb),
        (gen_random_uuid(), v_resolved_id, 'footer', 'Footer', 10, true, '{}'::jsonb, '[]'::jsonb)
      ON CONFLICT (restaurant_id, section_type) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Re-fetch after inserting
    SELECT jsonb_agg(s ORDER BY s.display_order ASC) INTO v_sections
    FROM public.homepage_sections s
    WHERE s.restaurant_id = v_resolved_id;
  END IF;

  -- 4. Fetch banners
  SELECT jsonb_agg(b ORDER BY b.display_order ASC) INTO v_banners
  FROM public.homepage_banners b
  WHERE b.restaurant_id = v_resolved_id;

  -- 5. Fetch services (with fallback to service_options and auto-seeding if empty)
  SELECT jsonb_agg(srv ORDER BY srv.display_order ASC) INTO v_services
  FROM public.homepage_services srv
  WHERE srv.restaurant_id = v_resolved_id;

  IF v_services IS NULL OR jsonb_array_length(v_services) = 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', opt.id::text,
      'restaurant_id', v_resolved_id,
      'service_title', opt.label,
      'service_subtitle', '',
      'active', opt.is_active,
      'service_image', opt.image_url,
      'service_icon', opt.service_key,
      'service_key', opt.service_key,
      'display_order', opt.sort_order
    ) ORDER BY opt.sort_order ASC) INTO v_services
    FROM public.service_options opt
    WHERE opt.restaurant_id = v_resolved_id AND opt.is_active = true;

    -- If still empty and restaurant exists, auto-seed default service options from Minerva
    IF (v_services IS NULL OR jsonb_array_length(v_services) = 0) AND v_exists THEN
      BEGIN
        INSERT INTO public.service_options (
          restaurant_id, service_key, label, sub_label, image_url, gradient, 
          border_class, text_class, countable, sort_order, is_active
        )
        SELECT 
          v_resolved_id, opt.service_key, opt.label, opt.sub_label, opt.image_url, opt.gradient,
          opt.border_class, opt.text_class, opt.countable, opt.sort_order, opt.is_active
        FROM public.service_options opt
        WHERE opt.restaurant_id = '202603180001'
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;

      SELECT jsonb_agg(jsonb_build_object(
        'id', opt.id::text,
        'restaurant_id', v_resolved_id,
        'service_title', opt.label,
        'service_subtitle', '',
        'active', opt.is_active,
        'service_image', opt.image_url,
        'service_icon', opt.service_key,
        'service_key', opt.service_key,
        'display_order', opt.sort_order
      ) ORDER BY opt.sort_order ASC) INTO v_services
      FROM public.service_options opt
      WHERE opt.restaurant_id = v_resolved_id AND opt.is_active = true;
    END IF;
  END IF;

  -- 6. Fetch categories (with fallback to categories table)
  SELECT jsonb_agg(c ORDER BY c.order_index ASC) INTO v_categories
  FROM public.homepage_categories c
  WHERE c.restaurant_id = v_resolved_id;

  IF v_categories IS NULL OR jsonb_array_length(v_categories) = 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', cat.id::text,
      'restaurant_id', v_resolved_id,
      'name', cat.name,
      'image_url', cat.image_url,
      'active', cat.is_active,
      'order_index', 0,
      'link', cat.id::text
    )) INTO v_categories
    FROM public.categories cat
    WHERE cat.restaurant_id = v_resolved_id AND cat.is_active = true;
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
  WHERE mi.restaurant_id = v_resolved_id AND mi.is_today_special = true;

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
  WHERE ts.restaurant_id = v_resolved_id AND (ts.special_type = 'combo' OR ts.is_combo = true);

  -- 9. Fetch offers
  SELECT jsonb_agg(o ORDER BY o.created_at DESC) INTO v_offers
  FROM public.offers o
  WHERE o.restaurant_id = v_resolved_id;

  -- 10. Fetch section style settings
  SELECT jsonb_agg(st) INTO v_section_styles
  FROM public.section_style_settings st
  WHERE st.restaurant_id = v_resolved_id;

  -- Return combined JSONB
  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'theme', COALESCE(v_theme, '{}'::jsonb),
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

GRANT EXECUTE ON FUNCTION public.get_homepage_config(TEXT) TO anon, authenticated, service_role;
