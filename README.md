# Rombi Closet

Frontend para el catalogo y panel administrativo de Rombi Closet, una tienda de ropa y accesorios para mascotas. La app permite publicar productos, filtrar el catalogo por categoria/talla/centimetros, reservar por WhatsApp y administrar imagenes en Supabase Storage.

## Stack

- React 19 + TypeScript
- Vite
- Material UI
- Supabase Auth, Database y Storage
- TanStack Query para cache del catalogo
- React Router

## Funcionalidades

- Catalogo publico con busqueda, filtro por categoria, rango de talla y rango de largo del lomo.
- Cards con precio en Bs., estado disponible/vendido y sello grafico para vendidos.
- Vista de detalle del producto con CTA de reserva por WhatsApp.
- Panel admin protegido por Supabase Auth.
- Crear, editar y eliminar productos.
- Subida de imagenes optimizadas a WebP.
- Fallback de Storage entre buckets `rombi-closet` y `rombi-closet2`.
- Confirmacion antes de borrar productos desde admin.
- Borrado manual de imagen en Storage al eliminar un producto.
- Cache compartida del listado de productos con TanStack Query.

## Requisitos

- Node.js 22 o compatible
- npm
- Proyecto de Supabase
- Buckets publicos de Storage:
  - `rombi-closet`
  - `rombi-closet2`

## Variables de entorno

Crea un archivo `.env.local` en la raiz:

```env
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
VITE_WHATSAPP_NUMBER=591XXXXXXXX
```

`VITE_WHATSAPP_NUMBER` debe ir con codigo de pais y sin espacios. Ejemplo para Bolivia: `59171234567`.

## Instalacion

```bash
npm install
npm run dev
```

La app corre normalmente en:

```txt
http://localhost:5173/
```

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de produccion
npm run lint     # revision con ESLint
npm run preview  # preview del build
```

## Estructura principal

```txt
src/
  App.tsx
  main.tsx
  assets/
    logo.png
    vendido.png
  components/
    ProductCard.tsx
  lib/
    productsApi.ts
    supabaseClient.ts
  pages/
    CatalogPage.tsx
    AdminDashboard.tsx
  types/
    product.ts
```

## Base de datos

La app espera una tabla `public.productos` con campos compatibles con:

```sql
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric not null,
  categoria text not null,
  talla integer,
  largo_cm integer,
  imagen_url text,
  image_bucket text,
  image_path text,
  disponible boolean default true,
  descuento integer default 0,
  sold_at timestamptz,
  created_at timestamptz default now()
);
```

Si ya tenias la tabla creada, agrega solo las columnas nuevas:

```sql
alter table public.productos
add column if not exists image_bucket text,
add column if not exists image_path text,
add column if not exists sold_at timestamptz;
```

Para rellenar `image_bucket` e `image_path` desde URLs publicas existentes:

```sql
update public.productos
set
  image_bucket = substring(imagen_url from '/storage/v1/object/public/([^/]+)/'),
  image_path = substring(imagen_url from '/storage/v1/object/public/[^/]+/(.*)$')
where imagen_url is not null
  and imagen_url like '%/storage/v1/object/public/%'
  and (image_bucket is null or image_path is null);
```

## Marcar vendidos automaticamente

Este trigger guarda la fecha cuando un producto pasa a vendido:

```sql
create or replace function public.set_product_sold_at()
returns trigger
language plpgsql
as $$
begin
  if new.disponible = false and old.disponible is distinct from false then
    new.sold_at = now();
  end if;

  if new.disponible = true then
    new.sold_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_set_product_sold_at on public.productos;

create trigger trigger_set_product_sold_at
before update of disponible on public.productos
for each row
execute function public.set_product_sold_at();
```

Para productos que ya estaban vendidos:

```sql
update public.productos
set sold_at = now()
where disponible = false
  and sold_at is null;
```

## Limpieza automatica de vendidos

Para borrar productos vendidos despues de 3 dias y tambien borrar su imagen de Storage, usa una Edge Function con `SUPABASE_SERVICE_ROLE_KEY`.

Nombre recomendado:

```txt
delete-sold-products
```

Codigo:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: products, error: fetchError } = await supabase
    .from("productos")
    .select("id, image_bucket, image_path")
    .eq("disponible", false)
    .not("sold_at", "is", null)
    .lt("sold_at", cutoff);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const results = [];

  for (const product of products ?? []) {
    if (product.image_bucket && product.image_path) {
      const { error: storageError } = await supabase.storage
        .from(product.image_bucket)
        .remove([product.image_path]);

      if (storageError) {
        results.push({
          id: product.id,
          imageDeleted: false,
          error: storageError.message,
        });
        continue;
      }
    }

    const { error: deleteError } = await supabase
      .from("productos")
      .delete()
      .eq("id", product.id);

    results.push({
      id: product.id,
      imageDeleted: Boolean(product.image_bucket && product.image_path),
      productDeleted: !deleteError,
      error: deleteError?.message ?? null,
    });
  }

  return Response.json({
    deleted: results.length,
    results,
  });
});
```

Luego programa el cron desde SQL Editor:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'delete-sold-products-and-images-after-3-days',
  '0 3 * * *',
  $$
    select net.http_post(
      url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/delete-sold-products',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer TU_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

No subas `TU_SERVICE_ROLE_KEY` al repositorio. Si se expone, rotala desde Supabase.

## Notas de Storage

- Los buckets deben permitir lectura publica si quieres que las imagenes se vean en el catalogo.
- No borres imagenes con `delete from storage.objects`; usa la API de Storage.
- El admin ya intenta borrar la imagen con `supabase.storage.from(bucket).remove([path])` antes de borrar el producto.

## Cache

El listado de productos usa TanStack Query con:

- `staleTime`: 5 minutos
- `gcTime`: 30 minutos
- `refetchOnWindowFocus`: desactivado

Cuando se crea, edita o borra un producto desde admin, se invalida la cache `["products"]`.

## Build

```bash
npm run lint
npm run build
```

El build puede mostrar advertencias de chunks grandes por Material UI/DataGrid. No bloquean la compilacion.
