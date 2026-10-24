-- New palette (Claude-style warm accents). Remaps the colors of the old palette
-- and gives the starter categories distinct colors instead of a single gold.

-- starter categories / accounts that still carry the old default color
update public.entities set color = v.color
from (values
  ('expense', 'Продукты',    '#5db872'),
  ('expense', 'Кафе',        '#e8a55a'),
  ('expense', 'Транспорт',   '#6b8fc7'),
  ('expense', 'Дом',         '#b59a5b'),
  ('expense', 'Здоровье',    '#d4728a'),
  ('expense', 'Развлечения', '#9a7bc4'),
  ('expense', 'Одежда',      '#5db8a6'),
  ('expense', 'Связь',       '#cc785c'),
  ('account', 'Наличные',    '#e8a55a')
) as v(kind, name, color)
where entities.kind = v.kind::public.entity_kind
  and entities.name = v.name
  and entities.color in ('#e0b44c', '#d9a441');

-- everything else: old palette -> new palette, position by position
update public.entities set color = m.new
from (values
  ('#e0b44c', '#e8a55a'),
  ('#d9a441', '#cc785c'),
  ('#6fbf73', '#5db872'),
  ('#4fa3d1', '#6b8fc7'),
  ('#9b7fd4', '#9a7bc4'),
  ('#e07a5f', '#cc785c'),
  ('#e85d75', '#d4728a'),
  ('#5fc1b5', '#5db8a6'),
  ('#b0a596', '#8e8b82')
) as m(old, new)
where entities.color = m.old;

alter table public.entities alter column color set default '#cc785c';

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name)
  values (hid, auth.uid(), btrim(p_display_name));

  insert into public.entities (household_id, kind, name, icon, color, position) values
    (hid, 'income',  'Зарплата',    'briefcase',     '#5db872', 0),
    (hid, 'account', 'Наличные',    'wallet',        '#e8a55a', 0),
    (hid, 'account', 'Карта',       'credit-card',   '#cc785c', 1),
    (hid, 'expense', 'Продукты',    'shopping-cart', '#5db872', 0),
    (hid, 'expense', 'Кафе',        'coffee',        '#e8a55a', 1),
    (hid, 'expense', 'Транспорт',   'bus',           '#6b8fc7', 2),
    (hid, 'expense', 'Дом',         'house',         '#b59a5b', 3),
    (hid, 'expense', 'Здоровье',    'heart-pulse',   '#d4728a', 4),
    (hid, 'expense', 'Развлечения', 'gamepad-2',     '#9a7bc4', 5),
    (hid, 'expense', 'Одежда',      'shirt',         '#5db8a6', 6),
    (hid, 'expense', 'Связь',       'smartphone',    '#cc785c', 7);

  return hid;
end;
$$;
