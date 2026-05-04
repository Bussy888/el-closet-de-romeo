import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
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
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import type { Session } from "@supabase/supabase-js";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { supabase } from "../lib/supabaseClient";
import { fetchProducts, productsQueryKey } from "../lib/productsApi";
import {
  emptyProductForm,
  formatPriceBs,
  getOriginalPrice,
  PRODUCT_CATEGORIES,
  type Product,
  type ProductFormValues,
} from "../types/product";

interface AdminDashboardProps {
  session: Session | null;
}

type FormErrors = Partial<
  Record<"name" | "description" | "price" | "category" | "image", string>
>;

const productImageBuckets = ["rombi-closet", "rombi-closet2"];

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
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

  const resetForm = () => {
    setFormValues(emptyProductForm);
    setSelectedFile(null);
    setErrors({});
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setFormValues({
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
    });
    setSelectedFile(null);
    setErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!formValues.name.trim()) {
      nextErrors.name = "El nombre es obligatorio.";
    }
    if (!formValues.description.trim()) {
      nextErrors.description = "La descripcion es obligatoria.";
    }
    if (!formValues.category) {
      nextErrors.category = "Selecciona una categoria.";
    }
    if (!formValues.price || Number(formValues.price) <= 0) {
      nextErrors.price = "Ingresa un precio valido.";
    }
    if (!formValues.id && !selectedFile) {
      nextErrors.image = "Debes seleccionar una imagen.";
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

      const maxWidth = 1200;
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
        canvas.toBlob(resolve, "image/webp", 0.78);
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

  const uploadImage = async () => {
    if (!selectedFile) {
      return {
        bucket: "",
        path: "",
        publicUrl: formValues.existingImageUrl ?? "",
      };
    }

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
        return {
          bucket: bucketName,
          path: fileName,
          publicUrl: data.publicUrl,
        };
      }

      lastUploadError = uploadError;
    }

    throw (
      lastUploadError ??
      new Error("No se pudo subir la imagen a ningun bucket disponible.")
    );
  };

  const deleteProductImage = async (product: Product) => {
    const storageObject =
      product.imageBucket && product.imagePath
        ? { bucket: product.imageBucket, path: product.imagePath }
        : getStorageObjectFromUrl(product.imageUrl);

    if (!storageObject) {
      return false;
    }

    const { error } = await supabase.storage
      .from(storageObject.bucket)
      .remove([storageObject.path]);

    if (error) {
      throw error;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const uploadedImage = await uploadImage();
      const existingStorageObject = getStorageObjectFromUrl(
        formValues.existingImageUrl ?? "",
      );
      const payload = {
        nombre: formValues.name.trim(),
        descripcion: formValues.description.trim(),
        precio: Number(formValues.price),
        categoria: formValues.category,
        talla: formValues.size,
        largo_cm: formValues.lengthCm,
        imagen_url: uploadedImage.publicUrl,
        image_bucket: uploadedImage.bucket || existingStorageObject?.bucket || null,
        image_path: uploadedImage.path || existingStorageObject?.path || null,
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
      const imageDeleted = await deleteProductImage(productToDelete);
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
          ? "Producto e imagen eliminados correctamente."
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
      headerName: "Precio",
      width: 110,
      valueFormatter: (value) => formatPriceBs(Number(value)),
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

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const previewProduct: Product = {
    id: formValues.id ?? "preview",
    name: formValues.name || "Nuevo articulo",
    description: formValues.description || "Describe aqui la prenda.",
    category: formValues.category,
    price: Number(formValues.price || 0),
    discount: formValues.discount,
    size: formValues.size,
    lengthCm: formValues.lengthCm,
    imageUrl: formValues.existingImageUrl ?? "",
    imageBucket: "",
    imagePath: "",
    isAvailable: formValues.isAvailable,
    createdAt: new Date().toISOString(),
  };
  const previewOriginalPrice = getOriginalPrice(previewProduct);
  const productsErrorMessage = productsError
    ? productsError instanceof Error
      ? productsError.message
      : "No se pudo cargar el catalogo."
    : "";

  return (
    <Box sx={{ py: { xs: 4, md: 5 } }}>
      <Container>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ mb: 4, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h4">Panel de administracion</Typography>
            <Typography color="text.secondary">
              Gestiona el catalogo, talla numerica, largo del lomo en cm y las
              imagenes optimizadas en webp de los buckets de Rombi Closet.
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
            borderRadius: 6,
            p: 2,
            border: "1px solid rgba(148, 163, 184, 0.12)",
          }}
        >
          <DataGrid
            rows={products}
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
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {formValues.id ? "Editar producto" : "Añadir Nuevo Producto"}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2.5}>
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
                  label="Precio"
                  type="number"
                  value={formValues.price}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
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

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <TextField
                  label="Descuento (%)"
                  type="number"
                  value={formValues.discount}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      discount: Math.max(
                        0,
                        Math.min(90, Number(event.target.value || 0)),
                      ),
                    }))
                  }
                />
                <FormHelperText>
                  Usa un porcentaje entero entre 0 y 90.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <Typography gutterBottom>
                  Talla numerica: {formValues.size}
                </Typography>
                <Slider
                  value={formValues.size}
                  min={0}
                  max={12}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_event, value) =>
                    setFormValues((current) => ({
                      ...current,
                      size: value as number,
                    }))
                  }
                />
                <FormHelperText>Rango de talla de 0 a 12.</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <Typography gutterBottom>
                  Largo del lomo: {formValues.lengthCm} cm
                </Typography>
                <Slider
                  value={formValues.lengthCm}
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
                <FormHelperText>
                  Ajusta el largo del lomo en centimetros.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth error={Boolean(errors.description)}>
                <TextField
                  label="Descripcion"
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
                <FormHelperText>{errors.description}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
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
                label={formValues.isAvailable ? "Disponible" : "No disponible"}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth error={Boolean(errors.image)}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadRoundedIcon />}
                >
                  {selectedFile
                    ? selectedFile.name
                    : "Subir imagen del producto"}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                  />
                </Button>
                <FormHelperText>
                  {errors.image ??
                    "La imagen se convierte a webp, se comprime antes del upload y luego se guarda su URL publica."}
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
                  Precio final: {formatPriceBs(previewProduct.price)}
                </Typography>
                {previewOriginalPrice ? (
                  <Typography variant="body2" color="text.secondary">
                    Precio antes del descuento:{" "}
                    {formatPriceBs(previewOriginalPrice)}
                  </Typography>
                ) : null}
              </Box>
            </Grid>

            {formValues.existingImageUrl && !selectedFile ? (
              <Grid size={12}>
                <Box
                  component="img"
                  src={formValues.existingImageUrl}
                  alt="Vista previa"
                  sx={{
                    width: 140,
                    height: 140,
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                />
              </Grid>
            ) : null}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
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
                    {formatPriceBs(productToDelete.price)}
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
        <DialogActions sx={{ px: 3, pb: 3 }}>
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
