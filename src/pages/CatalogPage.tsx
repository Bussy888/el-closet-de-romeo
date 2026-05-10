import { useEffect, useMemo, useState } from "react";
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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Skeleton,
  Slider,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import ProductCard from "../components/ProductCard";
import { fetchProducts, productsQueryKey } from "../lib/productsApi";
import {
  formatPriceBs,
  getFinalPrice,
  getOriginalPrice,
  getProductImages,
  getProductSizeIndex,
  PRODUCT_CATEGORIES,
  PRODUCT_SIZES,
  type Product,
} from "../types/product";
import sizeGuideUrl from "../assets/tallas.jpeg";

const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER ?? "";
const defaultSizeRange: [number, number] = [0, PRODUCT_SIZES.length - 1];
const defaultLengthRange: [number, number] = [10, 80];
const productsPerPage = 12;
type CatalogSortOption =
  | "available"
  | "price-asc"
  | "price-desc"
  | "size-asc"
  | "size-desc";

function CatalogPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof PRODUCT_CATEGORIES)[number]>("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sizeRange, setSizeRange] =
    useState<[number, number]>(defaultSizeRange);
  const [lengthRange, setLengthRange] =
    useState<[number, number]>(defaultLengthRange);
  const [sortOption, setSortOption] = useState<CatalogSortOption>("available");
  const [currentPage, setCurrentPage] = useState(1);
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

    return products
      .filter((product) => {
        const matchesCategory =
          selectedCategory === "Todos" || product.category === selectedCategory;
        const matchesSearch =
          !normalizedSearchTerm ||
          `${product.name} ${product.description} ${product.category}`
            .toLowerCase()
            .includes(normalizedSearchTerm);
        const productSizeIndex = getProductSizeIndex(product.size);
        const matchesSize =
          productSizeIndex >= sizeRange[0] && productSizeIndex <= sizeRange[1];
        const matchesLength =
          product.lengthCm >= lengthRange[0] &&
          product.lengthCm <= lengthRange[1];

        return matchesCategory && matchesSearch && matchesSize && matchesLength;
      })
      .sort((firstProduct, secondProduct) => {
        if (firstProduct.isAvailable !== secondProduct.isAvailable) {
          return firstProduct.isAvailable ? -1 : 1;
        }

        if (sortOption === "price-asc") {
          return getFinalPrice(firstProduct) - getFinalPrice(secondProduct);
        }

        if (sortOption === "price-desc") {
          return getFinalPrice(secondProduct) - getFinalPrice(firstProduct);
        }

        if (sortOption === "size-asc") {
          return (
            getProductSizeIndex(firstProduct.size) -
            getProductSizeIndex(secondProduct.size)
          );
        }

        if (sortOption === "size-desc") {
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
    lengthRange,
    products,
    searchTerm,
    selectedCategory,
    sizeRange,
    sortOption,
  ]);

  const resetFilters = () => {
    setSelectedCategory("Todos");
    setSearchTerm("");
    setSizeRange(defaultSizeRange);
    setLengthRange(defaultLengthRange);
    setSortOption("available");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [lengthRange, searchTerm, selectedCategory, sizeRange, sortOption]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / productsPerPage),
  );
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage,
  );

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    setSelectedImageIndex(0);
  };

  const normalizedWhatsappNumber = whatsappNumber.replace(/\D/g, "");
  const selectedOriginalPrice = selectedProduct
    ? getOriginalPrice(selectedProduct)
    : null;
  const selectedFinalPrice = selectedProduct
    ? getFinalPrice(selectedProduct)
    : 0;
  const selectedProductImages = selectedProduct
    ? getProductImages(selectedProduct)
    : [];
  const selectedImage =
    selectedProductImages[selectedImageIndex] ?? selectedProductImages[0];
  const hasMultipleSelectedImages = selectedProductImages.length > 1;
  const goToPreviousImage = () => {
    setSelectedImageIndex((current) =>
      current === 0 ? selectedProductImages.length - 1 : current - 1,
    );
  };
  const goToNextImage = () => {
    setSelectedImageIndex((current) =>
      current === selectedProductImages.length - 1 ? 0 : current + 1,
    );
  };
  const whatsappUrl = selectedProduct
    ? `https://wa.me/${normalizedWhatsappNumber}?text=${encodeURIComponent(
        `Hola, me interesa este producto para mi perrito:\n\n${selectedProduct.name}\nCategoria: ${selectedProduct.category}\nPrecio: ${formatPriceBs(selectedFinalPrice)}\nTalla: ${selectedProduct.size}\nLargo: ${selectedProduct.lengthCm} cm\nFoto: ${selectedImage?.url ?? selectedProduct.imageUrl}`,
      )}`
    : "";

  return (
    <Box sx={{ py: { xs: 2.5, md: 5 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 3 } }}>
        <Grid
          container
          spacing={{ xs: 2.5, md: 3.5 }}
          sx={{ alignItems: "flex-start" }}
        >
          <Grid size={{ xs: 12, md: 2.5 }}>
            <Box
              sx={{
                position: { md: "sticky" },
                top: 86,
                p: { xs: 2, md: 0 },
                border: { xs: "1px solid #eef2f7", md: 0 },
                borderRadius: { xs: 2, md: 0 },
                boxShadow: {
                  xs: "0 10px 24px rgba(15, 23, 42, 0.05)",
                  md: "none",
                },
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<StraightenRoundedIcon />}
                onClick={() => setSizeGuideOpen(true)}
                sx={{ display: { xs: "flex", md: "none" }, mb: 1.5 }}
              >
                Ver tabla de tallas
              </Button>
              <Accordion
                defaultExpanded={!isMobile}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: "transparent",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{
                    display: { xs: "flex", md: "none" },
                    minHeight: 0,
                    px: 0,
                    py: 0,
                    "& .MuiAccordionSummary-content": { my: 0 },
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    Filtros
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, pt: { xs: 2, md: 0 } }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      display: { xs: "none", md: "block" },
                      fontWeight: 900,
                      mb: 1.5,
                    }}
                  >
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
                          <SearchRoundedIcon
                            fontSize="small"
                            color="disabled"
                          />
                        ),
                      },
                    }}
                  />
                  <Divider sx={{ my: 2 }} />
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Categoria"
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(
                        event.target
                          .value as (typeof PRODUCT_CATEGORIES)[number],
                      )
                    }
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Divider sx={{ my: 2.5 }} />

                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 800 }}
                    >
                      ORDEN
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={sortOption}
                      onChange={(event) =>
                        setSortOption(event.target.value as CatalogSortOption)
                      }
                      sx={{ mt: 1.25 }}
                    >
                      <MenuItem value="available">Disponibles primero</MenuItem>
                      <MenuItem value="price-asc">
                        Precio menor a mayor
                      </MenuItem>
                      <MenuItem value="price-desc">
                        Precio mayor a menor
                      </MenuItem>
                      <MenuItem value="size-asc">Talla 00 a 10</MenuItem>
                      <MenuItem value="size-desc">Talla 10 a 00</MenuItem>
                    </TextField>
                  </Box>

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
                        {PRODUCT_SIZES[sizeRange[0]]} -{" "}
                        {PRODUCT_SIZES[sizeRange[1]]}
                      </Typography>
                    </Stack>
                    <Slider
                      value={sizeRange}
                      min={0}
                      max={PRODUCT_SIZES.length - 1}
                      step={1}
                      marks={PRODUCT_SIZES.map((size, index) => ({
                        value: index,
                        label: size,
                      }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => PRODUCT_SIZES[value]}
                      onChange={(_event, value) =>
                        setSizeRange(value as [number, number])
                      }
                    />
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<StraightenRoundedIcon />}
                      onClick={() => setSizeGuideOpen(true)}
                      sx={{ display: { xs: "none", md: "flex" }, mt: 1 }}
                    >
                      Ver tabla de tallas
                    </Button>
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
                      display: { xs: "none", md: "block" },
                      mt: 4,
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: "#eef8ff",
                      border: "1px solid #dff0fb",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                      El Closet de Romeo
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.75 }}
                    >
                      Prendas y accesorios para consentir a tu peludito.
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
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

            {error ? (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error instanceof Error
                  ? error.message
                  : "No se pudo cargar el catalogo."}
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
                {paginatedProducts.map((product) => (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <ProductCard product={product} onView={openProduct} />
                  </Grid>
                ))}
              </Grid>
            )}

            {!loading && filteredProducts.length > productsPerPage ? (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{
                  mt: 4,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Mostrando {(currentPage - 1) * productsPerPage + 1}-
                  {Math.min(
                    currentPage * productsPerPage,
                    filteredProducts.length,
                  )}{" "}
                  de {filteredProducts.length} productos
                </Typography>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  color="primary"
                  onChange={(_event, page) => setCurrentPage(page)}
                />
              </Stack>
            ) : null}

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
        onClose={closeProduct}
        fullScreen={isMobile}
        fullWidth
        maxWidth="lg"
        slotProps={{
          paper: {
            sx: {
              borderRadius: { xs: 0, sm: 2 },
              m: { xs: 0, sm: 4 },
            },
          },
        }}
      >
        {selectedProduct ? (
          <>
            <DialogTitle sx={{ p: 0 }}>
              <IconButton
                aria-label="Cerrar"
                onClick={closeProduct}
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
            <DialogContent
              sx={{
                p: { xs: 1.5, sm: 2, md: 4 },
                pb: { xs: 10, sm: 2, md: 4 },
              }}
            >
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
                      src={selectedImage?.url ?? selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      decoding="async"
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    {hasMultipleSelectedImages ? (
                      <>
                        <IconButton
                          aria-label="Foto anterior"
                          onClick={goToPreviousImage}
                          sx={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: "rgba(255,255,255,0.9)",
                            "&:hover": { bgcolor: "white" },
                          }}
                        >
                          <ArrowBackIosNewRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Foto siguiente"
                          onClick={goToNextImage}
                          sx={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: "rgba(255,255,255,0.9)",
                            "&:hover": { bgcolor: "white" },
                          }}
                        >
                          <ArrowForwardIosRoundedIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : null}
                    <Chip
                      label={selectedProduct.category}
                      size="small"
                      sx={{
                        display: { xs: "inline-flex", sm: "none" },
                        position: "absolute",
                        right: 12,
                        bottom: 12,
                        bgcolor: "#f97316",
                        color: "white",
                        fontWeight: 900,
                        borderRadius: 1,
                        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.16)",
                      }}
                    />
                  </Box>
                  {hasMultipleSelectedImages ? (
                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{
                        mt: 1.5,
                        overflowX: "auto",
                        pb: 0.5,
                      }}
                    >
                      {selectedProductImages.map((image, index) => (
                        <Box
                          key={`${image.url}-${index}`}
                          component="button"
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          aria-label={`Ver foto ${index + 1}`}
                          sx={{
                            width: { xs: 62, sm: 72 },
                            height: { xs: 62, sm: 72 },
                            p: 0,
                            flex: "0 0 auto",
                            cursor: "pointer",
                            overflow: "hidden",
                            borderRadius: 1.5,
                            border:
                              index === selectedImageIndex
                                ? "2px solid #f97316"
                                : "1px solid #e2e8f0",
                            bgcolor: "#f8fafc",
                          }}
                        >
                          <Box
                            component="img"
                            src={image.url}
                            alt={`${selectedProduct.name} ${index + 1}`}
                            loading="lazy"
                            decoding="async"
                            sx={{
                              width: "100%",
                              height: "100%",
                              display: "block",
                              objectFit: "cover",
                            }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  ) : null}
                </Grid>
                <Grid size={{ xs: 12, md: 5.5 }}>
                  <Stack
                    spacing={{ xs: 2.25, md: 4 }}
                    sx={{ height: "100%", justifyContent: "center" }}
                  >
                    <Box>
                      <Typography
                        variant="h4"
                        sx={{
                          mt: 1,
                          fontSize: { xs: 28, md: 36 },
                          lineHeight: 1.1,
                        }}
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
                        {formatPriceBs(selectedFinalPrice)}
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

                    {selectedProduct.description.trim() ? (
                      <Typography color="text.secondary">
                        {selectedProduct.description}
                      </Typography>
                    ) : null}

                    <Divider />

                    <Box>
                      <Box
                        sx={{
                          alignItems: "center",
                          display: "flex",
                          justifyContent: "center",
                          mb: 2,
                        }}
                      >
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<StraightenRoundedIcon />}
                          onClick={() => setSizeGuideOpen(true)}
                          sx={{ mt: -1, px: 0 }}
                        >
                          Ver tabla de tallas
                        </Button>
                      </Box>
                      <Stack
                        direction="row"
                        spacing={2}
                        sx={{ flexWrap: "wrap", rowGap: 1 }}
                      >
                        <Chip
                          label={selectedProduct.category}
                          sx={{
                            display: { xs: "none", sm: "inline-flex" },
                            bgcolor: "#fff7ed",
                            color: "primary.main",
                            fontWeight: 900,
                          }}
                        />
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
                      sx={{
                        position: { xs: "fixed", sm: "static" },
                        left: { xs: 16, sm: "auto" },
                        right: { xs: 16, sm: "auto" },
                        bottom: { xs: 16, sm: "auto" },
                        zIndex: { xs: 1301, sm: "auto" },
                        minHeight: { xs: 52, sm: 0 },
                        boxShadow: {
                          xs: "0 14px 34px rgba(22, 163, 74, 0.28)",
                          sm: "none",
                        },
                      }}
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

      <Dialog
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              borderRadius: { xs: 0, sm: 2 },
              overflow: "hidden",
              bgcolor: "transparent",
              boxShadow: "none",
            },
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            position: "relative",
            bgcolor: "transparent",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <IconButton
            aria-label="Cerrar tabla de tallas"
            onClick={() => setSizeGuideOpen(false)}
            sx={{
              position: "absolute",
              right: { xs: 8, sm: 10 },
              top: { xs: 8, sm: 10 },
              zIndex: 2,
              bgcolor: "rgba(255,255,255,0.92)",
              "&:hover": { bgcolor: "white" },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          <Box
            component="img"
            src={sizeGuideUrl}
            alt="Tabla de tallas Rombi Closet"
            loading="lazy"
            decoding="async"
            sx={{
              width: "100%",
              maxWidth: 520,
              maxHeight: { xs: "100vh", sm: "86vh" },
              objectFit: "contain",
              borderRadius: { xs: 0, sm: 2 },
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default CatalogPage;
