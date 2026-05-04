import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
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

const REMEMBERED_ADMIN_EMAIL_KEY = "rombi-admin-email";

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
  const [rememberProfile, setRememberProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(
      REMEMBERED_ADMIN_EMAIL_KEY,
    );

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberProfile(true);
    }
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
      email: email.trim(),
      password,
    });
    setSubmittingLogin(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (rememberProfile) {
      window.localStorage.setItem(REMEMBERED_ADMIN_EMAIL_KEY, email.trim());
    } else {
      window.localStorage.removeItem(REMEMBERED_ADMIN_EMAIL_KEY);
    }

    setLoginOpen(false);
    setPassword("");
    navigate("/admin");
  };

  const closeLogin = () => {
    if (submittingLogin) {
      return;
    }

    setLoginOpen(false);
    setAuthError("");
    setPassword("");
    setShowPassword(false);
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
          onClose={closeLogin}
          fullWidth
          maxWidth="xs"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
              },
            },
          }}
        >
          <DialogTitle sx={{ p: 0 }}>
            <Box
              sx={{
                px: 3,
                py: 2.5,
                background:
                  "linear-gradient(135deg, rgba(249,115,22,0.14), rgba(15,118,110,0.12))",
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Avatar
                  sx={{
                    width: 42,
                    height: 42,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                  }}
                >
                  <LockRoundedIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Ingreso de administrador
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Accede al panel para gestionar el catálogo.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={2.25} sx={{ pt: 3 }}>
              {rememberProfile && email ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    p: 1.5,
                    border: "1px solid #e2e8f0",
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{ alignItems: "center" }}
                  >
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: "secondary.main",
                        fontSize: 15,
                        fontWeight: 800,
                      }}
                    >
                      {email.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: 800 }}
                      >
                        Perfil recordado
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {email}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    onClick={() => {
                      window.localStorage.removeItem(
                        REMEMBERED_ADMIN_EMAIL_KEY,
                      );
                      setRememberProfile(false);
                      setEmail("");
                    }}
                  >
                    Cambiar
                  </Button>
                </Box>
              ) : null}
              <TextField
                label="Correo"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setAuthError("");
                }}
                fullWidth
                autoComplete="email"
                autoFocus={!email}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineRoundedIcon color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setAuthError("");
                }}
                fullWidth
                autoComplete="current-password"
                autoFocus={Boolean(email)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleLogin();
                  }
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRoundedIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"
                          }
                          edge="end"
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? (
                            <VisibilityOffRoundedIcon />
                          ) : (
                            <VisibilityRoundedIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberProfile}
                    onChange={(event) =>
                      setRememberProfile(event.target.checked)
                    }
                  />
                }
                label="Recordar este perfil"
              />
              {authError ? <Alert severity="error">{authError}</Alert> : null}
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2.25 }}>
            <Button onClick={closeLogin} disabled={submittingLogin}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleLogin}
              disabled={submittingLogin}
              startIcon={
                submittingLogin ? (
                  <CircularProgress color="inherit" size={16} />
                ) : (
                  <LoginRoundedIcon />
                )
              }
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
