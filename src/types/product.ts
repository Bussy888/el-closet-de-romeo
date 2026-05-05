export type ProductCategory =
  | "Invierno"
  | "Verano"
  | "Accesorios"
  | "Paseo"
  | "Basicos"
  | "Disfraces"
  | "Enterizo";

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
  images: ProductImage[];
  isAvailable: boolean;
  createdAt: string;
}

export interface ProductImage {
  url: string;
  bucket: string;
  path: string;
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
  imagenes: unknown;
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
  existingImages?: ProductImage[];
}

export const PRODUCT_CATEGORIES: Array<"Todos" | ProductCategory> = [
  "Todos",
  "Invierno",
  "Verano",
  "Accesorios",
  "Paseo",
  "Basicos",
  "Disfraces",
  "Enterizo",
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

function parseProductImages(row: ProductRow): ProductImage[] {
  const parsedImages = Array.isArray(row.imagenes)
    ? row.imagenes
        .map((image) => {
          if (!image || typeof image !== "object") {
            return null;
          }

          const record = image as Partial<ProductImage>;
          const url = typeof record.url === "string" ? record.url : "";

          if (!url) {
            return null;
          }

          return {
            url,
            bucket: typeof record.bucket === "string" ? record.bucket : "",
            path: typeof record.path === "string" ? record.path : "",
          };
        })
        .filter((image): image is ProductImage => Boolean(image))
    : [];

  if (parsedImages.length > 0) {
    return parsedImages;
  }

  if (!row.imagen_url) {
    return [];
  }

  return [
    {
      url: row.imagen_url,
      bucket: row.image_bucket ?? "",
      path: row.image_path ?? "",
    },
  ];
}

export function mapProductRow(row: ProductRow): Product {
  const images = parseProductImages(row);
  const primaryImage = images[0];

  return {
    id: row.id,
    name: row.nombre,
    description: row.descripcion ?? "",
    category: row.categoria,
    price: row.precio,
    discount: row.descuento ?? 0,
    size: row.talla ?? 0,
    lengthCm: row.largo_cm ?? 20,
    imageUrl: primaryImage?.url ?? row.imagen_url ?? "",
    imageBucket: primaryImage?.bucket ?? row.image_bucket ?? "",
    imagePath: primaryImage?.path ?? row.image_path ?? "",
    images,
    isAvailable: row.disponible ?? true,
    createdAt: row.created_at,
  };
}

export function getProductImages(product: Product) {
  return product.images.length > 0
    ? product.images
    : [
        {
          url: product.imageUrl,
          bucket: product.imageBucket,
          path: product.imagePath,
        },
      ].filter((image) => Boolean(image.url));
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
