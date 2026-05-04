import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Skeleton,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ProductCard from "../components/ProductCard";
import { fetchProducts, productsQueryKey } from "../lib/productsApi";
import {
  formatPriceBs,
  getOriginalPrice,
  PRODUCT_CATEGORIES,
  type Product,
} from "../types/product";

const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER ?? "";
const defaultSizeRange: [number, number] = [0, 12];
const defaultLengthRange: [number, number] = [10, 80];

function CatalogPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof PRODUCT_CATEGORIES)[number]>("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sizeRange, setSizeRange] =
    useState<[number, number]>(defaultSizeRange);
  const [lengthRange, setLengthRange] =
    useState<[number, number]>(defaultLengthRange);
  const {
    data: products = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: productsQueryKey,
    queryFn: fetchProducts,
  });

  const filteredProducts = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "Todos" || product.category === selectedCategory;
      const matchesSearch =
        !normalizedSearchTerm ||
        `${product.name} ${product.description} ${product.category}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      const matchesSize =
        product.size >= sizeRange[0] && product.size <= sizeRange[1];
      const matchesLength =
        product.lengthCm >= lengthRange[0] &&
        product.lengthCm <= lengthRange[1];

      return matchesCategory && matchesSearch && matchesSize && matchesLength;
    });
  }, [lengthRange, products, searchTerm, selectedCategory, sizeRange]);

  const resetFilters = () => {
    setSelectedCategory("Todos");
    setSearchTerm("");
    setSizeRange(defaultSizeRange);
    setLengthRange(defaultLengthRange);
  };

  const normalizedWhatsappNumber = whatsappNumber.replace(/\D/g, "");
  const selectedOriginalPrice = selectedProduct
    ? getOriginalPrice(selectedProduct)
    : null;
  const whatsappUrl = selectedProduct
    ? `https://wa.me/${normalizedWhatsappNumber}?text=${encodeURIComponent(
        `Hola, me interesa este producto para mi perrito:\n\n${selectedProduct.name}\nCategoria: ${selectedProduct.category}\nPrecio: ${formatPriceBs(selectedProduct.price)}\nTalla: ${selectedProduct.size}\nLargo: ${selectedProduct.lengthCm} cm`,
      )}`
    : "";

  return (
    <Box sx={{ py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={3.5} sx={{ alignItems: "flex-start" }}>
          <Grid size={{ xs: 12, md: 2.5 }}>
            <Box sx={{ position: { md: "sticky" }, top: 86 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2 }}>
                Filter Options
              </Typography>
              <TextField
                label="Buscar"
                size="small"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <SearchRoundedIcon fontSize="small" color="disabled" />
                    ),
                  },
                }}
              />
              <Divider sx={{ mb: 2 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 800 }}
              >
                CATEGORIAS
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                {PRODUCT_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    size="small"
                    onClick={() => setSelectedCategory(category)}
                    sx={{
                      justifyContent: "flex-start",
                      color:
                        selectedCategory === category
                          ? "primary.main"
                          : "text.primary",
                      bgcolor:
                        selectedCategory === category
                          ? "#fff7ed"
                          : "transparent",
                      fontWeight: selectedCategory === category ? 900 : 700,
                    }}
                  >
                    {category}
                  </Button>
                ))}
              </Stack>

              <Divider sx={{ my: 2.5 }} />

              <Box sx={{ mt: 3 }}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", mb: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 800 }}
                  >
                    TALLA
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sizeRange[0]} - {sizeRange[1]}
                  </Typography>
                </Stack>
                <Slider
                  value={sizeRange}
                  min={0}
                  max={12}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_event, value) =>
                    setSizeRange(value as [number, number])
                  }
                />
              </Box>

              <Box sx={{ mt: 2.5 }}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", mb: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 800 }}
                  >
                    LOMO CM
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lengthRange[0]} - {lengthRange[1]} cm
                  </Typography>
                </Stack>
                <Slider
                  value={lengthRange}
                  min={10}
                  max={80}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={(_event, value) =>
                    setLengthRange(value as [number, number])
                  }
                />
              </Box>

              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={resetFilters}
                sx={{ mt: 2 }}
              >
                Limpiar filtros
              </Button>

              <Box
                sx={{
                  mt: 4,
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: "#eef8ff",
                  border: "1px solid #dff0fb",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  Rombi Closet
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75 }}
                >
                  Prendas y accesorios para consentir a tu peludito.
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 9.5 }}>
            <Stack spacing={0.75} sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 800 }}
              >
                HOME / CATALOGO
              </Typography>
              <Typography
                variant="h3"
                sx={{ fontSize: { xs: 34, md: 44 }, lineHeight: 1 }}
              >
                Explora{" "}
                <Box
                  component="span"
                  sx={{ color: "primary.main", fontStyle: "italic" }}
                >
                  Nuestro
                </Box>{" "}
                Closet
              </Typography>
            </Stack>

            <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
              <Tabs
                value={selectedCategory}
                onChange={(_event, nextValue) => setSelectedCategory(nextValue)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <Tab key={category} label={category} value={category} />
                ))}
              </Tabs>
            </Box>

            {error ? (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error instanceof Error ? error.message : "No se pudo cargar el catalogo."}
              </Alert>
            ) : null}

            {loading ? (
              <Grid container spacing={3}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Grid key={index} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Skeleton variant="rounded" height={390} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={3}>
                {filteredProducts.map((product) => (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <ProductCard
                      product={product}
                      onView={setSelectedProduct}
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            {!loading && filteredProducts.length === 0 ? (
              <Alert severity="info" sx={{ mt: 3 }}>
                No hay productos en esta categoria todavia.
              </Alert>
            ) : null}
          </Grid>
        </Grid>
      </Container>

      <Dialog
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        {selectedProduct ? (
          <>
            <DialogTitle sx={{ p: 0 }}>
              <IconButton
                aria-label="Cerrar"
                onClick={() => setSelectedProduct(null)}
                sx={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  zIndex: 2,
                  bgcolor: "white",
                }}
              >
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
              <Grid container spacing={{ xs: 3, md: 5 }}>
                <Grid size={{ xs: 12, md: 6.5 }}>
                  <Box
                    sx={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      overflow: "hidden",
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    }}
                  >
                    <Box
                      component="img"
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1.25} sx={{ mt: 1.5 }}>
                    {[0, 1, 2, 3].map((item) => (
                      <Box
                        key={item}
                        component="img"
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        sx={{
                          width: 72,
                          height: 72,
                          objectFit: "cover",
                          borderRadius: 1.5,
                          border:
                            item === 0
                              ? "2px solid #f97316"
                              : "1px solid #e2e8f0",
                        }}
                      />
                    ))}
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 5.5 }}>
                  <Stack
                    spacing={4}
                    sx={{ height: "100%", justifyContent: "center" }}
                  >
                    <Box>
                      <Typography
                        variant="h4"
                        sx={{ mt: 1, fontSize: { xs: 30, md: 36 } }}
                      >
                        {selectedProduct.name}
                      </Typography>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "baseline" }}
                    >
                      <Typography variant="h5" color="primary.main">
                        {formatPriceBs(selectedProduct.price)}
                      </Typography>
                      {selectedOriginalPrice ? (
                        <Typography
                          color="text.secondary"
                          sx={{ textDecoration: "line-through" }}
                        >
                          {formatPriceBs(selectedOriginalPrice)}
                        </Typography>
                      ) : null}
                      {selectedProduct.discount > 0 ? (
                        <Chip
                          label={`-${selectedProduct.discount}%`}
                          color="error"
                          size="small"
                        />
                      ) : null}
                    </Stack>

                    <Typography color="text.secondary">
                      {selectedProduct.description}
                    </Typography>

                    <Divider />

                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 900, mb: 1 }}
                      >
                        Selecciona talla
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={`Talla ${selectedProduct.size}`}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`${selectedProduct.lengthCm} cm de lomo`}
                        />
                      </Stack>
                    </Box>

                    <Button
                      variant="contained"
                      color="success"
                      size="large"
                      startIcon={<WhatsAppIcon />}
                      disabled={!normalizedWhatsappNumber}
                      {...(normalizedWhatsappNumber
                        ? {
                            href: whatsappUrl,
                            target: "_blank",
                            rel: "noreferrer",
                          }
                        : {})}
                    >
                      Reservar ahora
                    </Button>
                    {/* <Button
                      variant="outlined"
                      startIcon={<FavoriteBorderRoundedIcon />}
                    >
                      Anadir a deseos
                    </Button> */}

                    {!normalizedWhatsappNumber ? (
                      <Alert severity="warning">
                        Configura VITE_WHATSAPP_NUMBER para activar la reserva
                        por WhatsApp.
                      </Alert>
                    ) : null}
                  </Stack>
                </Grid>
              </Grid>
            </DialogContent>
          </>
        ) : null}
      </Dialog>
    </Box>
  );
}

export default CatalogPage;
