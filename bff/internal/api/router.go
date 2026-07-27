package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// NewRouter wires middleware, health check, auth routes, and the declarative
// endpoint→SP registry.
func NewRouter(s *Service, spaOrigin string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors(spaOrigin))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// Auth (custom cookie logic)
	r.Post("/api/auth/login", s.handleLogin)
	r.Post("/api/auth/logout", s.handleLogout)
	r.Get("/api/auth/check", s.handleCheck)

	// Registry-driven data endpoints
	for _, ep := range endpoints() {
		r.MethodFunc(ep.method, ep.path, s.makeHandler(ep))
	}

	return r
}
