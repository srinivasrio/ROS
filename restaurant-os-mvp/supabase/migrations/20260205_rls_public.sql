-- Enable RLS (if not already)
alter table orders enable row level security;
alter table order_items enable row level security;
alter table menu_items enable row level security;
alter table categories enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Public Access" on orders;
drop policy if exists "Public Access" on order_items;
drop policy if exists "Public Access" on menu_items;
drop policy if exists "Public Access" on categories;

-- Create permissive policies for MVP (Anon Access)
create policy "Public Access" on orders for all using (true) with check (true);
create policy "Public Access" on order_items for all using (true) with check (true);
create policy "Public Access" on menu_items for all using (true) with check (true);
create policy "Public Access" on categories for all using (true) with check (true);
