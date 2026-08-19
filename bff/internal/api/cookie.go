package api

import "net/http"

// SessionCookieName holds the ASRILup Session_ID returned by
// usp_SM_ValidateLoginAccess. It is httpOnly — the SPA JS never sees the token;
// the BFF reads it here and injects it as the @Session_ID parameter on every SP.
const SessionCookieName = "asrilup_session"

func readSession(r *http.Request) string {
	c, err := r.Cookie(SessionCookieName)
	if err != nil {
		return ""
	}
	return c.Value
}

func setSession(w http.ResponseWriter, value string, secure, persistent bool) {
	c := &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
	// "Ingat saya" → cookie PERSISTEN (tahan tutup-buka browser). Tanpa ini cookie
	// bersifat session (hilang saat browser ditutup). Tetap dibatasi Expires_Date
	// sesi di T_Sessions (sisi server).
	if persistent {
		c.MaxAge = 60 * 60 * 24 * 30 // 30 hari
	}
	http.SetCookie(w, c)
}

func clearSession(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
