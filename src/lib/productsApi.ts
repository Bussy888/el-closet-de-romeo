import { supabase } from "./supabaseClient";
import { mapProductRow, type ProductRow } from "../types/product";

export const productsQueryKey = ["products"];

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ProductRow[]).map(mapProductRow);
}
