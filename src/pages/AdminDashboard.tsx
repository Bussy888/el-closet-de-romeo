import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  Slider,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import type { Session } from "@supabase/supabase-js";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { supabase } from "../lib/supabaseClient";
import { fetchProducts, productsQueryKey } from "../lib/productsApi";
import {
  emptyProductForm,
  formatPriceBs,
  getFinalPrice,
  getOriginalPrice,
  getProductSizeIndex,
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  type Product,
  type ProductFormValues,
  type ProductImage,
  type ProductSize,
} from "../types/product";

interface AdminDashboardProps {
  session: Session | null;
}

type FormErrors = Partial<
  Record<"name" | "price" | "category" | "image", string>
>;
type AdminSizeFilter = "Todas" | ProductSize;
type AdminAvailabilityFilter = "Todos" | "available" | "sold";
type AdminSortOption =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "size-asc"
  | "size-desc";

const productImageBuckets = ["rombi-closet", "rombi-closet2"];
const maxImagesPerProduct = 6;

function clampLengthCm(value: number) {
  return Math.max(10, Math.min(80, value || 10));
}

function clampDiscount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(90, value));
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function formatEditablePrice(value: number) {
  return Number.isFinite(value) && value > 0
    ? roundToTwoDecimals(value).toFixed(2)
    : "";
}

function getDiscountedPrice(price: string, discount: number) {
  const basePrice = Number(price);

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return 0;
  }

  return basePrice * (1 - clampDiscount(discount) / 100);
}

function getDiscountFromFinalPrice(price: string, finalPrice: string) {
  const basePrice = Number(price);
  const nextFinalPrice = Number(finalPrice);

  if (
    !Number.isFinite(basePrice) ||
    basePrice <= 0 ||
    !Number.isFinite(nextFinalPrice)
  ) {
    return 0;
  }

  return roundToTwoDecimals(
    clampDiscount((1 - nextFinalPrice / basePrice) * 100),
  );
}

function getExistingImageKey(image: ProductImage) {
  return `existing:${image.url}`;
}

function getSelectedFileKey(file: File) {
  return `new:${file.name}:${file.size}:${file.lastModified}`;
}

function orderImagesByPrimary(images: ProductImage[], primaryUrl: string) {
  const primaryIndex = images.findIndex((image) => image.url === primaryUrl);

  if (primaryIndex <= 0) {
    return images;
  }

  return [
    images[primaryIndex],
    ...images.slice(0, primaryIndex),
    ...images.slice(primaryIndex + 1),
  ];
}

function getStorageObjectFromUrl(imageUrl: string) {
  const match = imageUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);

  if (!match) {
    return null;
  }

  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  };
}

function AdminDashboard({ session }: AdminDashboardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();
  const {
    data: products = [],
    isLoading: loading,
    error: productsError,
  } = useQuery({
    queryKey: productsQueryKey,
    queryFn: fetchProducts,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<ProductFormValues>(emptyProductForm);
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagesPendingDeletion, setImagesPendingDeletion] = useState<
    ProductImage[]
  >([]);
  const [primaryImageKey, setPrimaryImageKey] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [adminSizeFilter, setAdminSizeFilter] =
    useState<AdminSizeFilter>("Todas");
  const [adminAvailabilityFilter, setAdminAvailabilityFilter] =
    useState<AdminAvailabilityFilter>("Todos");
  const [adminMinPrice, setAdminMinPrice] = useState("");
  const [adminMaxPrice, setAdminMaxPrice] = useState("");
  const [adminSort, setAdminSort] = useState<AdminSortOption>("newest");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const metrics = useMemo(() => {
    const unavailable = products.filter(
      (product) => !product.isAvailable,
    ).length;
    const active = products.length - unavailable;

    return [
      { label: "Total productos", value: products.length, tone: "#fff7ed" },
      { label: "Disponibles", value: active, tone: "#f0fdf4" },
      { label: "No disponibles", value: unavailable, tone: "#fef2f2" },
    ];
  }, [products]);

  const adminProducts = useMemo(() => {
    const minPrice = adminMinPrice.trim() ? Number(adminMinPrice) : null;
    const maxPrice = adminMaxPrice.trim() ? Number(adminMaxPrice) : null;

    return products
      .filter((product) => {
        const finalPrice = getFinalPrice(product);
        const matchesSize =
          adminSizeFilter === "Todas" || product.size === adminSizeFilter;
        const matchesAvailability =
          adminAvailabilityFilter === "Todos" ||
          (adminAvailabilityFilter === "available" && product.isAvailable) ||
          (adminAvailabilityFilter === "sold" && !product.isAvailable);
        const matchesMinPrice = minPrice === null || finalPrice >= minPrice;
        const matchesMaxPrice = maxPrice === null || finalPrice <= maxPrice;

        return (
          matchesSize &&
          matchesAvailability &&
          matchesMinPrice &&
          matchesMaxPrice
        );
      })
      .sort((firstProduct, secondProduct) => {
        if (adminSort === "price-asc") {
          return getFinalPrice(firstProduct) - getFinalPrice(secondProduct);
        }

        if (adminSort === "price-desc") {
          return getFinalPrice(secondProduct) - getFinalPrice(firstProduct);
        }

        if (adminSort === "size-asc") {
          return (
            getProductSizeIndex(firstProduct.size) -
            getProductSizeIndex(secondProduct.size)
          );
        }

        if (adminSort === "size-desc") {
          return (
            getProductSizeIndex(secondProduct.size) -
            getProductSizeIndex(firstProduct.size)
          );
        }

        return (
          new Date(secondProduct.createdAt).getTime() -
          new Date(firstProduct.createdAt).getTime()
        );
      });
  }, [
    adminAvailabilityFilter,
    adminMaxPrice,
    adminMinPrice,
    adminSizeFilter,
    adminSort,
    products,
  ]);

  const clearAdminFilters = () => {
    setAdminSizeFilter("Todas");
    setAdminAvailabilityFilter("Todos");
    setAdminMinPrice("");
    setAdminMaxPrice("");
    setAdminSort("newest");
  };

  const resetForm = () => {
    setFormValues(emptyProductForm);
    setDiscountedPrice("");
    setSelectedFiles([]);
    setImagesPendingDeletion([]);
    setPrimaryImageKey("");
    setIsDraggingImage(false);
    setErrors({});
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    const existingImages =
      product.images.length > 0
        ? product.images
        : product.imageUrl
          ? [
              {
                url: product.imageUrl,
                bucket: product.imageBucket,
                path: product.imagePath,
              },
            ]
          : [];

    const nextFormValues = {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      discount: product.discount,
      size: product.size,
      lengthCm: product.lengthCm,
      isAvailable: product.isAvailable,
      existingImageUrl: product.imageUrl,
      existingImages,
    };

    setFormValues(nextFormValues);
    setDiscountedPrice(
      formatEditablePrice(
        getDiscountedPrice(nextFormValues.price, nextFormValues.discount),
      ),
    );
    setSelectedFiles([]);
    setImagesPendingDeletion([]);
    setPrimaryImageKey(
      existingImages[0] ? getExistingImageKey(existingImages[0]) : "",
    );
    setErrors({});
    setDialogOpen(true);
  };

  const handlePriceChange = (nextPrice: string) => {
    setDiscountedPrice(
      formatEditablePrice(getDiscountedPrice(nextPrice, formValues.discount)),
    );
    setFormValues((current) => ({
      ...current,
      price: nextPrice,
    }));
  };

  const handleDiscountChange = (nextValue: string) => {
    const nextDiscount = roundToTwoDecimals(
      clampDiscount(Number(nextValue || 0)),
    );

    setDiscountedPrice(
      formatEditablePrice(getDiscountedPrice(formValues.price, nextDiscount)),
    );
    setFormValues((current) => ({
      ...current,
      discount: nextDiscount,
    }));
  };

  const handleDiscountedPriceChange = (nextFinalPrice: string) => {
    setDiscountedPrice(nextFinalPrice);
    setFormValues((current) => ({
      ...current,
      discount: getDiscountFromFinalPrice(current.price, nextFinalPrice),
    }));
  };

  const selectedFilePreviewUrls = useMemo(
    () => selectedFiles.map((file) => URL.createObjectURL(file)),
    [selectedFiles],
  );

  useEffect(() => {
    return () => {
      selectedFilePreviewUrls.forEach((previewUrl) =>
        URL.revokeObjectURL(previewUrl),
      );
    };
  }, [selectedFilePreviewUrls]);

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!formValues.name.trim()) {
      nextErrors.name = "El nombre es obligatorio.";
    }
    if (!formValues.category) {
      nextErrors.category = "Selecciona una categoria.";
    }
    if (!formValues.price || Number(formValues.price) <= 0) {
      nextErrors.price = "Ingresa un precio valido.";
    }
    if (
      !formValues.id &&
      selectedFiles.length === 0 &&
      !formValues.existingImages?.length
    ) {
      nextErrors.image = "Debes seleccionar al menos una imagen.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const optimizeImageToWebp = async (file: File) => {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () =>
          reject(new Error("No se pudo procesar la imagen seleccionada."));
        nextImage.src = imageUrl;
      });

      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("No se pudo inicializar la optimizacion de imagen.");
      }

      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.72);
      });

      if (!blob) {
        throw new Error("No se pudo generar la imagen en formato webp.");
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "producto";
      return new File([blob], `${baseName}.webp`, { type: "image/webp" });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const uploadSelectedImages = async (): Promise<ProductImage[]> => {
    if (selectedFiles.length === 0) {
      return [];
    }

    const uploadedImages: ProductImage[] = [];

    for (const selectedFile of selectedFiles) {
      const optimizedFile = await optimizeImageToWebp(selectedFile);
      const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
      let lastUploadError: Error | null = null;

      for (const bucketName of productImageBuckets) {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, optimizedFile, {
            upsert: false,
            contentType: "image/webp",
          });

        if (!uploadError) {
          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);
          uploadedImages.push({
            bucket: bucketName,
            path: fileName,
            url: data.publicUrl,
          });
          lastUploadError = null;
          break;
        }

        lastUploadError = uploadError;
      }

      if (lastUploadError) {
        throw lastUploadError;
      }
    }

    return uploadedImages;
  };

  const deleteProductImages = async (product: Product) => {
    const storageObjects = (
      product.images.length > 0
        ? product.images.map((image) =>
            image.bucket && image.path
              ? { bucket: image.bucket, path: image.path }
              : getStorageObjectFromUrl(image.url),
          )
        : [
            product.imageBucket && product.imagePath
              ? { bucket: product.imageBucket, path: product.imagePath }
              : getStorageObjectFromUrl(product.imageUrl),
          ]
    ).filter(
      (storageObject): storageObject is { bucket: string; path: string } =>
        Boolean(storageObject?.bucket && storageObject.path),
    );

    if (storageObjects.length === 0) {
      return false;
    }

    for (const storageObject of storageObjects) {
      const { error } = await supabase.storage
        .from(storageObject.bucket)
        .remove([storageObject.path]);

      if (error) {
        throw error;
      }
    }

    return true;
  };

  const deleteImagesFromStorage = async (images: ProductImage[]) => {
    const storageObjects = images
      .map((image) =>
        image.bucket && image.path
          ? { bucket: image.bucket, path: image.path }
          : getStorageObjectFromUrl(image.url),
      )
      .filter(
        (storageObject): storageObject is { bucket: string; path: string } =>
          Boolean(storageObject?.bucket && storageObject.path),
      );

    for (const storageObject of storageObjects) {
      const { error } = await supabase.storage
        .from(storageObject.bucket)
        .remove([storageObject.path]);

      if (error) {
        throw error;
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const existingImages = formValues.existingImages ?? [];
      const uploadedImages = await uploadSelectedImages();
      const allImages = [...existingImages, ...uploadedImages];
      const selectedFilePrimaryMatch = selectedFiles.find(
        (file) => getSelectedFileKey(file) === primaryImageKey,
      );
      const selectedFilePrimaryIndex = selectedFilePrimaryMatch
        ? selectedFiles.indexOf(selectedFilePrimaryMatch)
        : -1;
      const primaryUrl = primaryImageKey.startsWith("existing:")
        ? primaryImageKey.replace(/^existing:/, "")
        : (uploadedImages[selectedFilePrimaryIndex]?.url ??
          allImages[0]?.url ??
          "");
      const orderedImages = orderImagesByPrimary(allImages, primaryUrl);
      const primaryImage = orderedImages[0];
      const existingStorageObject = getStorageObjectFromUrl(
        formValues.existingImageUrl ?? "",
      );
      const payload = {
        nombre: formValues.name.trim(),
        descripcion: formValues.description.trim() || null,
        precio: Number(formValues.price),
        categoria: formValues.category,
        talla: formValues.size,
        largo_cm: clampLengthCm(formValues.lengthCm),
        imagen_url: primaryImage?.url ?? "",
        image_bucket:
          primaryImage?.bucket || existingStorageObject?.bucket || null,
        image_path: primaryImage?.path || existingStorageObject?.path || null,
        imagenes: orderedImages,
        disponible: formValues.isAvailable,
        descuento: formValues.discount,
      };

      const query = formValues.id
        ? supabase.from("productos").update(payload).eq("id", formValues.id)
        : supabase.from("productos").insert(payload);

      const { error } = await query;

      if (error) {
        throw error;
      }

      if (imagesPendingDeletion.length > 0) {
        await deleteImagesFromStorage(imagesPendingDeletion);
      }

      setStatusMessage({
        type: "success",
        text: formValues.id
          ? "Producto actualizado correctamente."
          : "Producto creado correctamente.",
      });
      setDialogOpen(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el producto.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) {
      return;
    }

    setDeletingProduct(true);
    setStatusMessage(null);

    try {
      const imageDeleted = await deleteProductImages(productToDelete);
      const { error } = await supabase
        .from("productos")
        .delete()
        .eq("id", productToDelete.id);

      if (error) {
        throw error;
      }

      setStatusMessage({
        type: "success",
        text: imageDeleted
          ? "Producto e imagenes eliminados correctamente."
          : "Producto eliminado. No se encontro metadata de imagen para borrar.",
      });
      setProductToDelete(null);
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el producto.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setDeletingProduct(false);
    }
  };

  const columns: GridColDef<Product>[] = [
    {
      field: "imageUrl",
      headerName: "Imagen",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Box
          component="img"
          src={params.value}
          alt={params.row.name}
          sx={{
            width: 52,
            height: 52,
            objectFit: "cover",
            borderRadius: 3,
            mt: 0.8,
          }}
        />
      ),
    },
    { field: "name", headerName: "Producto", flex: 1.1, minWidth: 180 },
    { field: "category", headerName: "Categoria", width: 130 },
    {
      field: "size",
      headerName: "Talla",
      width: 90,
    },
    {
      field: "lengthCm",
      headerName: "Largo cm",
      width: 110,
    },
    {
      field: "price",
      headerName: "Precio (Bs.)",
      width: 140,
      renderCell: (params) => {
        const finalPrice = getFinalPrice(params.row);
        const originalPrice = getOriginalPrice(params.row);

        return (
          <Stack sx={{ mt: 0.6 }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {formatPriceBs(finalPrice)}
            </Typography>
            {originalPrice ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textDecoration: "line-through" }}
              >
                {formatPriceBs(originalPrice)}
              </Typography>
            ) : null}
          </Stack>
        );
      },
    },
    {
      field: "discount",
      headerName: "Desc.",
      width: 90,
      valueFormatter: (value) => `${Number(value)}%`,
    },
    {
      field: "isAvailable",
      headerName: "Estado",
      width: 130,
      renderCell: (params) =>
        params.value ? (
          <Chip label="Disponible" color="success" size="small" />
        ) : (
          <Chip label="No disponible" color="warning" size="small" />
        ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button
            size="small"
            onClick={() => handleEdit(params.row)}
            startIcon={<EditRoundedIcon />}
          >
            Editar
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => setProductToDelete(params.row)}
            startIcon={<DeleteOutlineRoundedIcon />}
          >
            Borrar
          </Button>
        </Stack>
      ),
    },
  ];

  const selectImageFiles = (files?: FileList | File[] | null) => {
    const nextFiles = Array.from(files ?? []);
    const existingImageCount = formValues.existingImages?.length ?? 0;

    if (nextFiles.length === 0) {
      return;
    }

    if (nextFiles.some((file) => !file.type.startsWith("image/"))) {
      setErrors((current) => ({
        ...current,
        image: "Selecciona solamente archivos de imagen validos.",
      }));
      return;
    }

    if (existingImageCount + nextFiles.length > maxImagesPerProduct) {
      setErrors((current) => ({
        ...current,
        image: `Puedes guardar maximo ${maxImagesPerProduct} imagenes por producto.`,
      }));
      return;
    }

    setSelectedFiles(nextFiles);
    setPrimaryImageKey((current) =>
      current.startsWith("existing:")
        ? current
        : getSelectedFileKey(nextFiles[0]),
    );
    setErrors((current) => ({ ...current, image: undefined }));
  };

  const getFirstAvailableImageKey = (
    existingImages: ProductImage[],
    nextSelectedFiles: File[],
  ) => {
    if (existingImages[0]) {
      return getExistingImageKey(existingImages[0]);
    }

    if (nextSelectedFiles[0]) {
      return getSelectedFileKey(nextSelectedFiles[0]);
    }

    return "";
  };

  const handleRemoveExistingImage = (imageToRemove: ProductImage) => {
    setFormValues((current) => {
      const existingImages = current.existingImages ?? [];
      const nextExistingImages = existingImages.filter(
        (image) => image.url !== imageToRemove.url,
      );
      const removedKey = getExistingImageKey(imageToRemove);

      setPrimaryImageKey((currentPrimaryKey) =>
        currentPrimaryKey === removedKey
          ? getFirstAvailableImageKey(nextExistingImages, selectedFiles)
          : currentPrimaryKey,
      );

      return {
        ...current,
        existingImages: nextExistingImages,
        existingImageUrl: nextExistingImages[0]?.url ?? "",
      };
    });

    setImagesPendingDeletion((current) =>
      current.some((image) => image.url === imageToRemove.url)
        ? current
        : [...current, imageToRemove],
    );
  };

  const handleRemoveSelectedFile = (fileIndex: number) => {
    setSelectedFiles((current) => {
      const removedFile = current[fileIndex];
      const removedKey = removedFile ? getSelectedFileKey(removedFile) : "";
      const nextSelectedFiles = current.filter(
        (_, index) => index !== fileIndex,
      );
      const existingImages = formValues.existingImages ?? [];

      setPrimaryImageKey((currentPrimaryKey) =>
        currentPrimaryKey === removedKey
          ? getFirstAvailableImageKey(existingImages, nextSelectedFiles)
          : currentPrimaryKey,
      );

      return nextSelectedFiles;
    });
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectImageFiles(event.target.files);
  };

  const onImageDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingImage(true);
  };

  const onImageDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);
  };

  const onImageDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);
    selectImageFiles(event.dataTransfer.files);
  };

  const previewProduct: Product = {
    id: formValues.id ?? "preview",
    name: formValues.name || "Nuevo articulo",
    description: formValues.description,
    category: formValues.category,
    price: Number(formValues.price || 0),
    discount: formValues.discount,
    size: formValues.size,
    lengthCm: formValues.lengthCm,
    imageUrl: formValues.existingImageUrl ?? "",
    imageBucket: "",
    imagePath: "",
    images: formValues.existingImages ?? [],
    isAvailable: formValues.isAvailable,
    createdAt: new Date().toISOString(),
  };
  const previewOriginalPrice = getOriginalPrice(previewProduct);
  const previewFinalPrice = getFinalPrice(previewProduct);
  const productsErrorMessage = productsError
    ? productsError instanceof Error
      ? productsError.message
      : "No se pudo cargar el catalogo."
    : "";

  return (
    <Box sx={{ py: { xs: 2.5, md: 5 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ mb: 4, justifyContent: "space-between" }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontSize: { xs: 28, sm: 34 }, lineHeight: 1.1 }}
            >
              Panel de administracion
            </Typography>
            <Typography color="text.secondary">
              Gestiona el catalogo, talla numerica, largo del lomo en cm y
              descuentos.
            </Typography>
            {session?.user?.email ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                Sesion activa: {session.user.email}
              </Typography>
            ) : null}
          </Box>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={handleOpenCreate}
            sx={{
              minHeight: 48,
              px: 2.75,
              alignSelf: { xs: "stretch", sm: "flex-start" },
              bgcolor: "primary.main",
              background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
              boxShadow: "0 14px 28px rgba(249, 115, 22, 0.28)",
              color: "white",
              fontWeight: 900,
              "&:hover": {
                bgcolor: "primary.dark",
                background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
                boxShadow: "0 18px 34px rgba(249, 115, 22, 0.34)",
                transform: "translateY(-1px)",
              },
              "& .MuiButton-startIcon": {
                width: 26,
                height: 26,
                mr: 1,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(255,255,255,0.18)",
              },
            }}
          >
            Añadir Nuevo Producto
          </Button>
        </Stack>

        {statusMessage ? (
          <Alert severity={statusMessage.type} sx={{ mb: 3 }}>
            {statusMessage.text}
          </Alert>
        ) : null}

        {productsErrorMessage ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {productsErrorMessage}
          </Alert>
        ) : null}

        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {metrics.map((metric) => (
            <Grid key={metric.label} size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  p: 3,
                  minHeight: { xs: 112, md: "auto" },
                  borderRadius: 6,
                  bgcolor: metric.tone,
                  border: "1px solid rgba(148, 163, 184, 0.14)",
                }}
              >
                <Typography color="text.secondary">{metric.label}</Typography>
                <Typography variant="h4">{metric.value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: { xs: 2, md: 6 },
            p: { xs: 1, md: 2 },
            border: "1px solid rgba(148, 163, 184, 0.12)",
            overflowX: "auto",
          }}
        >
          <Grid container spacing={1.5} sx={{ mb: 2, alignItems: "center" }}>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-size-filter-label">Talla</InputLabel>
                <Select
                  labelId="admin-size-filter-label"
                  label="Talla"
                  value={adminSizeFilter}
                  onChange={(event) =>
                    setAdminSizeFilter(event.target.value as AdminSizeFilter)
                  }
                >
                  <MenuItem value="Todas">Todas</MenuItem>
                  {PRODUCT_SIZES.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-status-filter-label">Estado</InputLabel>
                <Select
                  labelId="admin-status-filter-label"
                  label="Estado"
                  value={adminAvailabilityFilter}
                  onChange={(event) =>
                    setAdminAvailabilityFilter(
                      event.target.value as AdminAvailabilityFilter,
                    )
                  }
                >
                  <MenuItem value="Todos">Todos</MenuItem>
                  <MenuItem value="available">Disponible</MenuItem>
                  <MenuItem value="sold">Vendido</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, sm: 3, md: 1.7 }}>
              <TextField
                fullWidth
                size="small"
                label="Precio min."
                type="number"
                value={adminMinPrice}
                onChange={(event) => setAdminMinPrice(event.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, md: 1.7 }}>
              <TextField
                fullWidth
                size="small"
                label="Precio max."
                type="number"
                value={adminMaxPrice}
                onChange={(event) => setAdminMaxPrice(event.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="admin-sort-label">Ordenar</InputLabel>
                <Select
                  labelId="admin-sort-label"
                  label="Ordenar"
                  value={adminSort}
                  onChange={(event) =>
                    setAdminSort(event.target.value as AdminSortOption)
                  }
                >
                  <MenuItem value="newest">Mas recientes</MenuItem>
                  <MenuItem value="price-asc">Precio menor a mayor</MenuItem>
                  <MenuItem value="price-desc">Precio mayor a menor</MenuItem>
                  <MenuItem value="size-asc">Talla 00 a 10</MenuItem>
                  <MenuItem value="size-desc">Talla 10 a 00</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <Button fullWidth variant="outlined" onClick={clearAdminFilters}>
                Limpiar filtros
              </Button>
            </Grid>
          </Grid>

          <DataGrid
            rows={adminProducts}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[5, 10, 20]}
            initialState={{
              pagination: { paginationModel: { pageSize: 5, page: 0 } },
            }}
            sx={{
              border: 0,
              minWidth: 860,
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#fff7ed",
              },
            }}
          />
        </Box>
      </Container>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {formValues.id ? "Editar producto" : "Añadir Nuevo Producto"}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: { xs: 2, sm: 3 } }}>
          <Grid container spacing={2.5} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <FormControl fullWidth error={Boolean(errors.name)}>
                <TextField
                  label="Nombre del producto"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <FormHelperText>{errors.name}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <FormControl fullWidth error={Boolean(errors.price)}>
                <TextField
                  label="Precio (Bs.)"
                  type="number"
                  value={formValues.price}
                  onChange={(event) => handlePriceChange(event.target.value)}
                />
                <FormHelperText>{errors.price}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth error={Boolean(errors.category)}>
                <InputLabel id="category-label">Categoria</InputLabel>
                <Select
                  labelId="category-label"
                  label="Categoria"
                  value={formValues.category}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      category: event.target
                        .value as ProductFormValues["category"],
                    }))
                  }
                >
                  {PRODUCT_CATEGORIES.filter(
                    (category) => category !== "Todos",
                  ).map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.category}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth>
                <TextField
                  label="Descuento (%)"
                  type="number"
                  value={formValues.discount}
                  onChange={(event) => handleDiscountChange(event.target.value)}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      max: 90,
                      step: 0.01,
                    },
                  }}
                />
                <FormHelperText>Entre 0 y 90.</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 3 }}>
              <FormControl fullWidth>
                <TextField
                  label="Precio con descuento (Bs.)"
                  type="number"
                  value={discountedPrice}
                  onChange={(event) =>
                    handleDiscountedPriceChange(event.target.value)
                  }
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      step: 0.01,
                    },
                  }}
                />
                <FormHelperText>Recalcula el descuento.</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="size-label">Talla</InputLabel>
                <Select
                  labelId="size-label"
                  label="Talla"
                  value={formValues.size}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      size: event.target.value as ProductSize,
                    }))
                  }
                >
                  {PRODUCT_SIZES.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Rango de talla de 00 a 10.</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <Typography gutterBottom>
                  Largo del lomo: {formValues.lengthCm} cm
                </Typography>
                <Stack
                  direction={{ xs: "column-reverse", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                >
                  <Box sx={{ flex: 1, px: { xs: 0, sm: 1 } }}>
                    <Slider
                      value={clampLengthCm(formValues.lengthCm)}
                      min={10}
                      max={80}
                      step={1}
                      valueLabelDisplay="auto"
                      onChange={(_event, value) =>
                        setFormValues((current) => ({
                          ...current,
                          lengthCm: value as number,
                        }))
                      }
                    />
                  </Box>
                  <TextField
                    label="Escribir centimetros"
                    type="number"
                    value={formValues.lengthCm || ""}
                    sx={{ width: { xs: "100%", sm: 190 } }}
                    slotProps={{
                      htmlInput: {
                        min: 10,
                        max: 80,
                        step: 1,
                      },
                    }}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        lengthCm: Number(event.target.value),
                      }))
                    }
                    onBlur={() =>
                      setFormValues((current) => ({
                        ...current,
                        lengthCm: clampLengthCm(current.lengthCm),
                      }))
                    }
                  />
                </Stack>
                <FormHelperText>
                  Ajusta con el control o escribe un valor entre 10 y 80 cm.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth>
                <TextField
                  label="Descripcion (opcional)"
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  minRows={4}
                  multiline
                />
              </FormControl>
            </Grid>

            <Grid
              size={{ xs: 12, md: 6 }}
              sx={{
                display: "flex",
                alignContent: "center",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={formValues.isAvailable}
                    onChange={(_event, checked) =>
                      setFormValues((current) => ({
                        ...current,
                        isAvailable: checked,
                      }))
                    }
                  />
                }
                label={formValues.isAvailable ? "Disponible" : "Vendido"}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth error={Boolean(errors.image)}>
                <Box
                  component="label"
                  onDragOver={onImageDragOver}
                  onDragLeave={onImageDragLeave}
                  onDrop={onImageDrop}
                  sx={{
                    minHeight: { xs: 56, md: 152 },
                    px: 2,
                    py: { xs: 1.5, md: 2.5 },
                    display: "flex",
                    flexDirection: { xs: "row", md: "column" },
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    textAlign: "center",
                    cursor: "pointer",
                    borderRadius: 3,
                    border: "1.5px dashed",
                    borderColor: errors.image
                      ? "error.main"
                      : isDraggingImage
                        ? "primary.main"
                        : "#cbd5e1",
                    bgcolor: isDraggingImage ? "#fff7ed" : "#f8fafc",
                    transition:
                      "border-color 160ms ease, background 160ms ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "#fff7ed",
                    },
                  }}
                >
                  <CloudUploadRoundedIcon color="primary" />
                  <Box>
                    <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                      {selectedFiles.length > 0
                        ? `${selectedFiles.length} imagen${
                            selectedFiles.length === 1 ? "" : "es"
                          } seleccionada${
                            selectedFiles.length === 1 ? "" : "s"
                          }`
                        : isMobile
                          ? "Subir imagenes"
                          : "Arrastra imagenes aqui"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: "none", md: "block" }, mt: 0.5 }}
                    >
                      o haz click para seleccionarla desde tu equipo
                    </Typography>
                  </Box>
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onFileChange}
                  />
                </Box>
                <FormHelperText>
                  {errors.image ??
                    `Las imagenes se convierten a webp, se comprimen antes del upload y se limita a ${maxImagesPerProduct} fotos por producto.`}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  bgcolor: "#fff7ed",
                  border: "1px solid rgba(249,115,22,0.16)",
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Vista previa de datos
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip label={`Talla ${previewProduct.size}`} />
                  <Chip label={`${previewProduct.lengthCm} cm`} />
                  <Chip
                    label={
                      previewProduct.isAvailable
                        ? "Disponible"
                        : "No disponible"
                    }
                    color={previewProduct.isAvailable ? "success" : "default"}
                  />
                  {previewProduct.discount > 0 ? (
                    <Chip
                      label={`-${previewProduct.discount}%`}
                      color="primary"
                    />
                  ) : null}
                </Stack>
                <Typography sx={{ mt: 1.5 }}>
                  Precio final: {formatPriceBs(previewFinalPrice)}
                </Typography>
                {previewOriginalPrice ? (
                  <Typography variant="body2" color="text.secondary">
                    Precio base: {formatPriceBs(previewOriginalPrice)}
                  </Typography>
                ) : null}
              </Box>
            </Grid>

            {formValues.existingImages?.length || selectedFiles.length > 0 ? (
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Galeria del producto
                </Typography>
                <Box
                  sx={{
                    overflowX: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 2,
                  }}
                >
                  <Table size="small" sx={{ minWidth: 620 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Foto</TableCell>
                        <TableCell>Origen</TableCell>
                        <TableCell align="center">Principal</TableCell>
                        <TableCell align="right">Accion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(formValues.existingImages ?? []).map((image, index) => {
                        const imageKey = getExistingImageKey(image);
                        const isPrimary = imageKey === primaryImageKey;

                        return (
                          <TableRow key={`${image.url}-${index}`}>
                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={1.25}
                                sx={{ alignItems: "center" }}
                              >
                                <Box
                                  component="img"
                                  src={image.url}
                                  alt={`Foto existente ${index + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    objectFit: "cover",
                                    borderRadius: 1.5,
                                    bgcolor: "#f8fafc",
                                  }}
                                />
                                {isPrimary ? (
                                  <Chip
                                    icon={<StarRoundedIcon />}
                                    label="Principal"
                                    size="small"
                                    color="primary"
                                  />
                                ) : null}
                              </Stack>
                            </TableCell>
                            <TableCell>Actual</TableCell>
                            <TableCell align="center">
                              <Radio
                                checked={isPrimary}
                                onChange={() => setPrimaryImageKey(imageKey)}
                                slotProps={{
                                  input: {
                                    "aria-label": `Usar foto actual ${
                                      index + 1
                                    } como principal`,
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteOutlineRoundedIcon />}
                                onClick={() => handleRemoveExistingImage(image)}
                              >
                                Borrar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {selectedFiles.map((file, index) => {
                        const imageKey = getSelectedFileKey(file);
                        const isPrimary = imageKey === primaryImageKey;

                        return (
                          <TableRow key={imageKey}>
                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={1.25}
                                sx={{ alignItems: "center" }}
                              >
                                <Box
                                  component="img"
                                  src={selectedFilePreviewUrls[index]}
                                  alt={file.name}
                                  loading="lazy"
                                  decoding="async"
                                  sx={{
                                    width: 64,
                                    height: 64,
                                    objectFit: "cover",
                                    borderRadius: 1.5,
                                    bgcolor: "#f8fafc",
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    maxWidth: 220,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {file.name}
                                </Typography>
                                {isPrimary ? (
                                  <Chip
                                    icon={<StarRoundedIcon />}
                                    label="Principal"
                                    size="small"
                                    color="primary"
                                  />
                                ) : null}
                              </Stack>
                            </TableCell>
                            <TableCell>Nueva</TableCell>
                            <TableCell align="center">
                              <Radio
                                checked={isPrimary}
                                onChange={() => setPrimaryImageKey(imageKey)}
                                slotProps={{
                                  input: {
                                    "aria-label": `Usar foto nueva ${
                                      index + 1
                                    } como principal`,
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteOutlineRoundedIcon />}
                                onClick={() => handleRemoveSelectedFile(index)}
                              >
                                Quitar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Grid>
            ) : null}
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 3 },
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: "stretch",
            gap: 1,
            "& > :not(style) ~ :not(style)": { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "Guardando..." : "Guardar Producto"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(productToDelete)}
        onClose={() => {
          if (!deletingProduct) {
            setProductToDelete(null);
          }
        }}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { m: { xs: 1.5, sm: 4 } } } }}
      >
        <DialogTitle>Eliminar producto</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {productToDelete ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  component="img"
                  src={productToDelete.imageUrl}
                  alt={productToDelete.name}
                  sx={{
                    width: 72,
                    height: 72,
                    objectFit: "cover",
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  }}
                />
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>
                    {productToDelete.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatPriceBs(getFinalPrice(productToDelete))}
                  </Typography>
                </Box>
              </Stack>
              <Alert severity="warning">
                Esta accion eliminara el producto del catalogo y tambien su
                imagen en Supabase Storage.
              </Alert>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: 2, sm: 3 },
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: "stretch",
            gap: 1,
            "& > :not(style) ~ :not(style)": { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button
            onClick={() => setProductToDelete(null)}
            disabled={deletingProduct}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={() => void handleDelete()}
            disabled={deletingProduct}
          >
            {deletingProduct ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminDashboard;
