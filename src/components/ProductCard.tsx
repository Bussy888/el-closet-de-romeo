import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  formatPriceBs,
  getFinalPrice,
  getOriginalPrice,
  type Product,
} from "../types/product";
import soldStampUrl from "../assets/vendido.png";

interface ProductCardProps {
  product: Product;
  onView: (product: Product) => void;
}

function ProductCard({ product, onView }: ProductCardProps) {
  const originalPrice = getOriginalPrice(product);
  const finalPrice = getFinalPrice(product);

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #eef2f7",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
      }}
    >
      <Box sx={{ position: "relative", bgcolor: "#f8fafc" }}>
        <CardMedia
          component="img"
          image={product.imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          sx={{
            height: { xs: 280, sm: 245 },
            objectFit: "cover",
            filter: product.isAvailable ? "none" : "grayscale(0.35)",
          }}
        />
        <Chip
          label={product.category}
          size="small"
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            bgcolor: "#f97316",
            color: "white",
            fontWeight: 800,
            borderRadius: 1,
          }}
        />
        {!product.isAvailable ? (
          <Box
            component="img"
            src={soldStampUrl}
            alt="Vendido"
            loading="lazy"
            decoding="async"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "90%",
              maxHeight: "90%",
              objectFit: "contain",
              opacity: 0.86,
              transform: "translate(-50%, -50%) rotate(-10deg)",
              pointerEvents: "none",
              filter: "drop-shadow(0 10px 18px rgba(127, 29, 29, 0.2))",
            }}
          />
        ) : null}
      </Box>

      <CardContent sx={{ flexGrow: 1, px: 2.25, pb: 1.5 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 1,
          }}
        >
          <Typography variant="h6" sx={{ fontSize: { xs: 19, sm: 18 }, lineHeight: 1.18 }}>
            {product.name}
          </Typography>
          <Typography
            variant="caption"
            color="primary.main"
            sx={{ fontWeight: 800 }}
          >
            {product.isAvailable ? "EN STOCK" : "VENDIDO"}
          </Typography>
        </Stack>

        {product.description.trim() ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ minHeight: 42 }}
          >
            {product.description}
          </Typography>
        ) : null}

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.75, alignItems: "baseline" }}
        >
          <Typography variant="h6" color="primary.main" sx={{ fontSize: 18 }}>
            {formatPriceBs(finalPrice)}
          </Typography>
          {originalPrice ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: "line-through" }}
            >
              {formatPriceBs(originalPrice)}
            </Typography>
          ) : null}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 1 }}
        >
          <Chip label={`Talla ${product.size}`} size="small" />
          <Chip label={`${product.lengthCm} cm`} size="small" />
          {product.discount > 0 ? (
            <Chip
              label={`-${product.discount}%`}
              size="small"
              color="primary"
            />
          ) : null}
        </Stack>
      </CardContent>

      <Box sx={{ px: 2.25, pb: 2.25 }}>
        <Button
          fullWidth
          variant={product.isAvailable ? "contained" : "outlined"}
          color={product.isAvailable ? "primary" : "warning"}
          startIcon={
            product.isAvailable ? <VisibilityRoundedIcon /> : undefined
          }
          disabled={!product.isAvailable}
          onClick={() => onView(product)}
          sx={product.isAvailable ? { color: "white" } : undefined}
        >
          {product.isAvailable ? "Ver producto" : "VENDIDO"}
        </Button>
      </Box>
    </Card>
  );
}

export default ProductCard;
