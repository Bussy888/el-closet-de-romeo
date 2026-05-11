import { supabase } from "./supabaseClient";
import { mapProductRow, type ProductRow } from "../types/product";

export const productsQueryKey = ["products"];
const productsFetchLimit = 1000;

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("productos")
    .select(
      "id,nombre,descripcion,precio,categoria,talla,largo_cm,imagen_url,image_bucket,image_path,imagenes,disponible,descuento,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(productsFetchLimit);

  if (error) {
    throw error;
  }

  return (data as ProductRow[]).map(mapProductRow);
}
