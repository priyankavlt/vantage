-- Sample e-commerce data for trying Vantage. Deterministic: same data every time.
-- Runs once, when the warehouse container's volume is first created.

select setseed(0.42);

create table customers (
  id          serial primary key,
  name        text not null,
  email       text not null unique,
  country     text not null,
  signed_up_at timestamptz not null
);

create table products (
  id        serial primary key,
  name      text not null,
  category  text not null,
  price     numeric(10, 2) not null
);

create table orders (
  id          serial primary key,
  customer_id int not null references customers (id),
  status      text not null check (status in ('pending', 'shipped', 'delivered', 'cancelled')),
  placed_at   timestamptz not null
);

create table order_items (
  order_id   int not null references orders (id),
  product_id int not null references products (id),
  quantity   int not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  primary key (order_id, product_id)
);

insert into customers (name, email, country, signed_up_at)
select
  'Customer ' || g,
  'customer' || g || '@example.com',
  (array['United States', 'United Kingdom', 'Germany', 'India', 'Canada', 'Brazil', 'Japan', 'France'])[1 + floor(random() * 8)::int],
  timestamptz '2025-01-01 00:00:00+00' + random() * interval '600 days'
from generate_series(1, 2000) g;

insert into products (name, category, price)
select
  p.name, p.category, p.price
from (values
  ('Espresso Beans 1kg', 'Coffee', 24.00), ('Filter Roast 500g', 'Coffee', 14.50),
  ('Decaf Blend 500g', 'Coffee', 13.00), ('Cold Brew Pack', 'Coffee', 18.00),
  ('Pour-over Kettle', 'Equipment', 59.00), ('Burr Grinder', 'Equipment', 129.00),
  ('French Press', 'Equipment', 35.00), ('Espresso Machine', 'Equipment', 499.00),
  ('Ceramic Mug', 'Accessories', 12.00), ('Travel Tumbler', 'Accessories', 22.00),
  ('Paper Filters (100)', 'Accessories', 6.50), ('Digital Scale', 'Accessories', 39.00),
  ('Matcha Tin', 'Tea', 21.00), ('Earl Grey 250g', 'Tea', 11.00), ('Chai Spice Mix', 'Tea', 9.50)
) as p(name, category, price);

insert into orders (customer_id, status, placed_at)
select
  1 + floor(random() * 2000)::int,
  (array['delivered', 'delivered', 'delivered', 'shipped', 'pending', 'cancelled'])[1 + floor(random() * 6)::int],
  -- More orders over time, with a December bump.
  timestamptz '2025-03-01 00:00:00+00' + (sqrt(random()) * 600) * interval '1 day'
from generate_series(1, 12000);

insert into order_items (order_id, product_id, quantity, unit_price)
select o.id, p.id, 1 + floor(random() * 3)::int, p.price
from orders o
cross join lateral (
  select id, price from products order by random() + o.id * 0 limit 1 + floor(random() * 3)::int
) p;

create view monthly_revenue as
select
  date_trunc('month', o.placed_at)::date as month,
  count(distinct o.id) as orders,
  sum(oi.quantity * oi.unit_price) as revenue
from orders o
join order_items oi on oi.order_id = o.id
where o.status <> 'cancelled'
group by 1
order by 1;

-- A read-only role, as recommended for every Vantage connection.
create role vantage_reader login password 'reader';
grant connect on database shop to vantage_reader;
grant usage on schema public to vantage_reader;
grant select on all tables in schema public to vantage_reader;
