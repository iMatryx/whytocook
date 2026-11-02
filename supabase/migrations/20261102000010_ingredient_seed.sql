-- Editorial identities/labels only. No nutrient values, density or substitutions.
DO $seed$
DECLARE
  catalog jsonb := $catalog$[
  {
    "slug": "carne-de-pui",
    "name": "Carne de pui",
    "kind": "generic",
    "parent": null,
    "relation": null,
    "category": "carne",
    "aliases": {
      "ro-RO": [
        "Carne de pui",
        "pui"
      ],
      "en-GB": [
        "Chicken meat"
      ],
      "ru-RU": [
        "Куриное мясо",
        "мясо курицы"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "piept-de-pui",
    "name": "Piept de pui",
    "kind": "specific",
    "parent": "carne-de-pui",
    "relation": "part_of",
    "category": "carne",
    "aliases": {
      "ro-RO": [
        "Piept de pui"
      ],
      "en-GB": [
        "Chicken breast",
        "chicken breasts"
      ],
      "ru-RU": [
        "Куриная грудка",
        "грудка курицы"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "orez",
    "name": "Orez",
    "kind": "generic",
    "parent": null,
    "relation": null,
    "category": "cereale-si-fainuri",
    "aliases": {
      "ro-RO": [
        "Orez"
      ],
      "en-GB": [
        "Rice"
      ],
      "ru-RU": [
        "Рис"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "orez-alb",
    "name": "Orez alb",
    "kind": "specific",
    "parent": "orez",
    "relation": "variant_of",
    "category": "cereale-si-fainuri",
    "aliases": {
      "ro-RO": [
        "Orez alb"
      ],
      "en-GB": [
        "White rice"
      ],
      "ru-RU": [
        "Белый рис"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "faina",
    "name": "Făină",
    "kind": "generic",
    "parent": null,
    "relation": null,
    "category": "cereale-si-fainuri",
    "aliases": {
      "ro-RO": [
        "Făină"
      ],
      "en-GB": [
        "Flour"
      ],
      "ru-RU": [
        "Мука"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "faina-de-grau",
    "name": "Făină de grâu",
    "kind": "specific",
    "parent": "faina",
    "relation": "variant_of",
    "category": "cereale-si-fainuri",
    "aliases": {
      "ro-RO": [
        "Făină de grâu"
      ],
      "en-GB": [
        "Wheat flour"
      ],
      "ru-RU": [
        "Пшеничная мука"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "lapte",
    "name": "Lapte",
    "kind": "generic",
    "parent": null,
    "relation": null,
    "category": "lactate",
    "aliases": {
      "ro-RO": [
        "Lapte"
      ],
      "en-GB": [
        "Milk"
      ],
      "ru-RU": [
        "Молоко"
      ]
    },
    "units": [
      "ml",
      "l"
    ],
    "defaultUnit": "ml"
  },
  {
    "slug": "lapte-de-vaca",
    "name": "Lapte de vacă",
    "kind": "specific",
    "parent": "lapte",
    "relation": "variant_of",
    "category": "lactate",
    "aliases": {
      "ro-RO": [
        "Lapte de vacă"
      ],
      "en-GB": [
        "Cow's milk",
        "cow milk"
      ],
      "ru-RU": [
        "Коровье молоко"
      ]
    },
    "units": [
      "ml",
      "l"
    ],
    "defaultUnit": "ml"
  },
  {
    "slug": "ou-de-gaina",
    "name": "Ou de găină",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "oua",
    "aliases": {
      "ro-RO": [
        "Ou de găină",
        "ouă de găină"
      ],
      "en-GB": [
        "Hen egg",
        "chicken egg",
        "hen eggs"
      ],
      "ru-RU": [
        "Куриное яйцо",
        "куриные яйца"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "piece"
  },
  {
    "slug": "rosii",
    "name": "Roșii",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Roșii",
        "tomate",
        "roșie",
        "tomată"
      ],
      "en-GB": [
        "Tomato",
        "tomatoes"
      ],
      "ru-RU": [
        "Помидор",
        "помидоры",
        "томат",
        "томаты"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "ceapa",
    "name": "Ceapă",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Ceapă",
        "cepe"
      ],
      "en-GB": [
        "Onion",
        "onions"
      ],
      "ru-RU": [
        "Репчатый лук",
        "лук репчатый"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "usturoi",
    "name": "Usturoi",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Usturoi"
      ],
      "en-GB": [
        "Garlic"
      ],
      "ru-RU": [
        "Чеснок"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "cartof",
    "name": "Cartof",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Cartof",
        "cartofi"
      ],
      "en-GB": [
        "Potato",
        "potatoes"
      ],
      "ru-RU": [
        "Картофель",
        "картошка"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "morcov",
    "name": "Morcov",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Morcov",
        "morcovi"
      ],
      "en-GB": [
        "Carrot",
        "carrots"
      ],
      "ru-RU": [
        "Морковь"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "ardei-gras",
    "name": "Ardei gras",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Ardei gras"
      ],
      "en-GB": [
        "Bell pepper",
        "sweet pepper"
      ],
      "ru-RU": [
        "Сладкий перец",
        "болгарский перец"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "castravete",
    "name": "Castravete",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Castravete",
        "castraveți"
      ],
      "en-GB": [
        "Cucumber",
        "cucumbers"
      ],
      "ru-RU": [
        "Огурец",
        "огурцы"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "dovlecel",
    "name": "Dovlecel",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Dovlecel",
        "dovlecei"
      ],
      "en-GB": [
        "Zucchini",
        "courgette"
      ],
      "ru-RU": [
        "Кабачок",
        "кабачки"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "vanata",
    "name": "Vânătă",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Vânătă",
        "vinete"
      ],
      "en-GB": [
        "Eggplant",
        "aubergine"
      ],
      "ru-RU": [
        "Баклажан",
        "баклажаны"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "broccoli",
    "name": "Broccoli",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Broccoli",
        "brocoli"
      ],
      "en-GB": [
        "Broccoli"
      ],
      "ru-RU": [
        "Брокколи"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "spanac",
    "name": "Spanac",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "legume",
    "aliases": {
      "ro-RO": [
        "Spanac"
      ],
      "en-GB": [
        "Spinach"
      ],
      "ru-RU": [
        "Шпинат"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "mar",
    "name": "Măr",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "fructe",
    "aliases": {
      "ro-RO": [
        "Măr",
        "mere"
      ],
      "en-GB": [
        "Apple",
        "apples"
      ],
      "ru-RU": [
        "Яблоко",
        "яблоки"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "banana",
    "name": "Banană",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "fructe",
    "aliases": {
      "ro-RO": [
        "Banană",
        "banane"
      ],
      "en-GB": [
        "Banana",
        "bananas"
      ],
      "ru-RU": [
        "Банан",
        "бананы"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "lamaie",
    "name": "Lămâie",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "fructe",
    "aliases": {
      "ro-RO": [
        "Lămâie",
        "lămâi"
      ],
      "en-GB": [
        "Lemon",
        "lemons"
      ],
      "ru-RU": [
        "Лимон",
        "лимоны"
      ]
    },
    "units": [
      "g",
      "kg",
      "piece"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "zahar",
    "name": "Zahăr",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "condimente-si-zahar",
    "aliases": {
      "ro-RO": [
        "Zahăr"
      ],
      "en-GB": [
        "Sugar"
      ],
      "ru-RU": [
        "Сахар"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "sare-alimentara",
    "name": "Sare alimentară",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "condimente-si-zahar",
    "aliases": {
      "ro-RO": [
        "Sare alimentară",
        "sare"
      ],
      "en-GB": [
        "Edible salt",
        "table salt"
      ],
      "ru-RU": [
        "Пищевая соль",
        "поваренная соль"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "ulei-de-masline",
    "name": "Ulei de măsline",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "uleiuri-si-grasimi",
    "aliases": {
      "ro-RO": [
        "Ulei de măsline"
      ],
      "en-GB": [
        "Olive oil"
      ],
      "ru-RU": [
        "Оливковое масло"
      ]
    },
    "units": [
      "ml",
      "l"
    ],
    "defaultUnit": "ml"
  },
  {
    "slug": "ulei-de-floarea-soarelui",
    "name": "Ulei de floarea-soarelui",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "uleiuri-si-grasimi",
    "aliases": {
      "ro-RO": [
        "Ulei de floarea-soarelui"
      ],
      "en-GB": [
        "Sunflower oil"
      ],
      "ru-RU": [
        "Подсолнечное масло"
      ]
    },
    "units": [
      "ml",
      "l"
    ],
    "defaultUnit": "ml"
  },
  {
    "slug": "unt",
    "name": "Unt",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "uleiuri-si-grasimi",
    "aliases": {
      "ro-RO": [
        "Unt"
      ],
      "en-GB": [
        "Butter"
      ],
      "ru-RU": [
        "Сливочное масло"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "iaurt-natural",
    "name": "Iaurt natural",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "lactate",
    "aliases": {
      "ro-RO": [
        "Iaurt natural"
      ],
      "en-GB": [
        "Plain yogurt",
        "plain yoghurt"
      ],
      "ru-RU": [
        "Натуральный йогурт"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "linte",
    "name": "Linte",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "leguminoase",
    "aliases": {
      "ro-RO": [
        "Linte"
      ],
      "en-GB": [
        "Lentils",
        "lentil"
      ],
      "ru-RU": [
        "Чечевица"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "fasole-boabe",
    "name": "Fasole boabe",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "leguminoase",
    "aliases": {
      "ro-RO": [
        "Fasole boabe",
        "boabe de fasole"
      ],
      "en-GB": [
        "Beans",
        "bean seeds"
      ],
      "ru-RU": [
        "Фасоль в зернах"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  },
  {
    "slug": "naut",
    "name": "Năut",
    "kind": "specific",
    "parent": null,
    "relation": null,
    "category": "leguminoase",
    "aliases": {
      "ro-RO": [
        "Năut"
      ],
      "en-GB": [
        "Chickpeas",
        "chickpea"
      ],
      "ru-RU": [
        "Нут"
      ]
    },
    "units": [
      "g",
      "kg"
    ],
    "defaultUnit": "g"
  }
]$catalog$::jsonb;
  food jsonb; language text; label text; ingredient_uuid uuid; category_uuid uuid;
  unit_code text; unit_uuid uuid; alias_owner uuid; preferred boolean;
BEGIN
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('carne','Carne') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('lactate','Lactate') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('oua','Ouă') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('cereale-si-fainuri','Cereale și făinuri') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('legume','Legume') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('fructe','Fructe') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('leguminoase','Leguminoase') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('uleiuri-si-grasimi','Uleiuri și grăsimi') ON CONFLICT(slug) DO NOTHING;
  INSERT INTO app_private.ingredient_categories(slug,name) VALUES ('condimente-si-zahar','Condimente și zahăr') ON CONFLICT(slug) DO NOTHING;
  FOR food IN SELECT value FROM jsonb_array_elements(catalog) LOOP
    SELECT id INTO category_uuid FROM app_private.ingredient_categories WHERE slug=food->>'category';
    INSERT INTO app_private.ingredients(slug,name,category_id,identity_kind)
      VALUES(food->>'slug',food->>'name',category_uuid,food->>'kind') ON CONFLICT(slug) DO NOTHING;
    SELECT id INTO ingredient_uuid FROM app_private.ingredients WHERE slug=food->>'slug'
      AND search_key=app_private.ingredient_search_key(food->>'name') AND identity_kind=food->>'kind';
    IF ingredient_uuid IS NULL THEN RAISE EXCEPTION 'Catalog identity conflict for %',food->>'slug'; END IF;
    FOREACH language IN ARRAY ARRAY['ro-RO','ru-RU','en-GB'] LOOP
      FOR label IN SELECT value FROM jsonb_array_elements_text(food->'aliases'->language) LOOP
        SELECT ingredient_id INTO alias_owner FROM app_private.ingredient_aliases
          WHERE locale=language AND normalized_alias=app_private.normalize_label(label);
        IF alias_owner IS NOT NULL AND alias_owner<>ingredient_uuid THEN RAISE EXCEPTION 'Catalog alias conflict'; END IF;
        preferred:=NOT EXISTS(SELECT 1 FROM app_private.ingredient_aliases WHERE ingredient_id=ingredient_uuid AND locale=language AND is_preferred);
        INSERT INTO app_private.ingredient_aliases(ingredient_id,locale,alias,is_preferred)
          VALUES(ingredient_uuid,language,label,preferred) ON CONFLICT(locale,normalized_alias) DO NOTHING;
      END LOOP;
    END LOOP;
    FOR unit_code IN SELECT value FROM jsonb_array_elements_text(food->'units') LOOP
      SELECT id INTO unit_uuid FROM app_private.units WHERE code=unit_code;
      IF unit_uuid IS NULL THEN RAISE EXCEPTION 'Required catalog unit absent'; END IF;
      INSERT INTO app_private.ingredient_units(ingredient_id,unit_id,is_default)
        VALUES(ingredient_uuid,unit_uuid,unit_code=food->>'defaultUnit' AND NOT EXISTS(
          SELECT 1 FROM app_private.ingredient_units WHERE ingredient_id=ingredient_uuid AND is_default))
        ON CONFLICT(ingredient_id,unit_id) DO NOTHING;
    END LOOP;
  END LOOP;
  FOR food IN SELECT value FROM jsonb_array_elements(catalog) WHERE value->>'parent' IS NOT NULL LOOP
    UPDATE app_private.ingredients SET broader_ingredient_id=(SELECT id FROM app_private.ingredients WHERE slug=food->>'parent'),
      broader_relation=food->>'relation' WHERE slug=food->>'slug' AND broader_ingredient_id IS NULL;
  END LOOP;
END;
$seed$;
