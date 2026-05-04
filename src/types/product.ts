export type ProductCategory =
  | "Invierno"
  | "Verano"
  | "Accesorios"
  | "Paseo"
  | "Basicos";

export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  discount: number;
  size: number;
  lengthCm: number;
  imageUrl: string;
  imageBucket: string;
  imagePath: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface ProductRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: ProductCategory;
  talla: number | null;
  largo_cm: number | null;
  imagen_url: string | null;
  image_bucket: string | null;
  image_path: string | null;
  disponible: boolean | null;
  descuento: number | null;
  created_at: string;
}

export interface ProductFormValues {
  id?: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: string;
  discount: number;
  size: number;
  lengthCm: number;
  isAvailable: boolean;
  existingImageUrl?: string;
}

export const PRODUCT_CATEGORIES: Array<"Todos" | ProductCategory> = [
  "Todos",
  "Invierno",
  "Verano",
  "Accesorios",
  "Paseo",
  "Basicos",
];

export const emptyProductForm: ProductFormValues = {
  name: "",
  description: "",
  category: "Invierno",
  price: "",
  discount: 0,
  size: 0,
  lengthCm: 20,
  isAvailable: true,
};

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.nombre,
    description: row.descripcion ?? "",
    category: row.categoria,
    price: row.precio,
    discount: row.descuento ?? 0,
    size: row.talla ?? 0,
    lengthCm: row.largo_cm ?? 20,
    imageUrl: row.imagen_url ?? "",
    imageBucket: row.image_bucket ?? "",
    imagePath: row.image_path ?? "",
    isAvailable: row.disponible ?? true,
    createdAt: row.created_at,
  };
}

export function getOriginalPrice(product: Product) {
  if (!product.discount) {
    return null;
  }

  return product.price;
}

export function getFinalPrice(product: Product) {
  if (!product.discount) {
    return product.price;
  }

  return product.price * (1 - product.discount / 100);
}

export function formatPriceBs(value: number) {
  return `Bs. ${value.toFixed(2)}`;
}
