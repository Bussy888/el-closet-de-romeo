import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  createTheme,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import {
  BrowserRouter,
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import CatalogPage from "./pages/CatalogPage";
import AdminDashboard from "./pages/AdminDashboard";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import logoUrl from "./assets/logo.png";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#f97316", dark: "#c2410c", light: "#fdba74" },
    secondary: { main: "#0f766e", light: "#5eead4" },
    background: { default: "#ffffff", paper: "#ffffff" },
    success: { main: "#16a34a" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Inter', 'Trebuchet MS', 'Segoe UI', sans-serif",
    h3: { fontWeight: 800 },
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 6, paddingInline: 18 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});

function hasAdminAccess(session: Session | null) {
  if (!session?.user) {
    return false;
  }

  const role = (session.user.app_metadata?.role ??
    session.user.user_metadata?.role ??
    "") as string;
  return role ? role === "admin" : true;
}

function ProtectedRoute({
  session,
  children,
}: {
  session: Session | null;
  children: ReactElement;
}) {
  const location = useLocation();

  if (!session) {
    return (
      <Navigate to="/" replace state={{ redirectTo: location.pathname }} />
    );
  }

  if (!hasAdminAccess(session)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoadingSession(false);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const adminEnabled = useMemo(() => hasAdminAccess(session), [session]);

  const handleLogin = async () => {
    if (!email || !password) {
      setAuthError("Completa correo y contraseña.");
      return;
    }

    setSubmittingLogin(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmittingLogin(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setLoginOpen(false);
    setPassword("");
    navigate("/admin");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          background: "#ffffff",
        }}
      >
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            bgcolor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <Toolbar
            sx={{ gap: { xs: 1, sm: 2 }, minHeight: 58, px: { xs: 2, md: 4 } }}
          >
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: "flex",
                alignItems: "center",
                textDecoration: "none",
                flexGrow: 1,
              }}
            >
              <Box
                component="img"
                src={logoUrl}
                alt="Rombi Closet"
                sx={{ height: 80, objectFit: "contain", p: 0.8 }}
              />
            </Box>

            <Button
              component={RouterLink}
              to="/"
              color={location.pathname === "/" ? "primary" : "inherit"}
            >
              Catálogo
            </Button>

            {adminEnabled ? (
              <Button
                component={RouterLink}
                to="/admin"
                startIcon={<DashboardRoundedIcon />}
                color={
                  location.pathname.startsWith("/admin") ? "primary" : "inherit"
                }
              >
                Admin
              </Button>
            ) : null}

            {session ? (
              <Button
                color="inherit"
                startIcon={<LogoutRoundedIcon />}
                onClick={handleLogout}
              >
                Salir
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<LoginRoundedIcon />}
                onClick={() => setLoginOpen(true)}
              >
                Login
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {!isSupabaseConfigured ? (
          <Container sx={{ pt: 3 }}>
            <Alert severity="warning">
              Configura `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y
              `VITE_WHATSAPP_NUMBER` para activar Auth, DB, Storage y el CTA de
              WhatsApp.
            </Alert>
          </Container>
        ) : null}

        {loadingSession ? (
          <Stack
            sx={{
              minHeight: "50vh",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Stack>
        ) : (
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute session={session}>
                  <AdminDashboard session={session} />
                </ProtectedRoute>
              }
            />
          </Routes>
        )}

        <Dialog
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Ingreso de administrador</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="Correo"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                fullWidth
              />
              <TextField
                label="Contraseña"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
              />
              {authError ? <Alert severity="error">{authError}</Alert> : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setLoginOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handleLogin}
              disabled={submittingLogin}
            >
              {submittingLogin ? "Ingresando..." : "Entrar"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
