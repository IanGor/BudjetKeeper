-- Things 3 palette (see src/lib/icons.ts): remaps the colors of the previous palette,
-- position by position, and updates the colors of the starter set.

update public.entities set color = m.new
from (values
  ('#cc785c', '#3a86f0'),
  ('#e8a55a', '#f08c3a'),
  ('#b59a5b', '#bfa26a'),
  ('#5db872', '#4cb860'),
  ('#5db8a6', '#3fb3a1'),
  ('#6b8fc7', '#3a86f0'),
  ('#9a7bc4', '#9a73d9'),
  ('#d4728a', '#d965a0'),
  ('#8e8b82', '#8b9099')
) as m(old, new)
where entities.color = m.old;

alter table public.entities alter column color set default '#3a86f0';

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
    (hid, 'income',  'Зарплата',    'briefcase',     '#4cb860', 0),
    (hid, 'account', 'Наличные',    'wallet',        '#f08c3a', 0),
    (hid, 'account', 'Карта',       'credit-card',   '#3a86f0', 1),
    (hid, 'expense', 'Продукты',    'shopping-cart', '#4cb860', 0),
    (hid, 'expense', 'Кафе',        'coffee',        '#f08c3a', 1),
    (hid, 'expense', 'Транспорт',   'bus',           '#3a86f0', 2),
    (hid, 'expense', 'Дом',         'house',         '#bfa26a', 3),
    (hid, 'expense', 'Здоровье',    'heart-pulse',   '#e8475f', 4),
    (hid, 'expense', 'Развлечения', 'gamepad-2',     '#9a73d9', 5),
    (hid, 'expense', 'Одежда',      'shirt',         '#3fb3a1', 6),
    (hid, 'expense', 'Связь',       'smartphone',    '#d965a0', 7);

  return hid;
end;
$$;
