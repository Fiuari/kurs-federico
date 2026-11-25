// Resolve from this script, so nested room pages and GitHub Pages use the same base.
const hotelRoot = new URL("../../", document.currentScript.src);
function accountUrl() {
  const url = new URL("auth.html", hotelRoot);
  const current = new URL(location.href);
  if (current.pathname.endsWith("/booking.html")) {
    url.searchParams.set("room", current.searchParams.get("room") || "");
    url.searchParams.set("next", "booking");
  }
  if (current.pathname.endsWith("/admin.html")) url.searchParams.set("next", "admin");
  return url;
}
function authErrorMessage(error) {
  const messages = {
    invalid_credentials: "Email or password is incorrect.",
    email_not_confirmed: "Confirm your email using the link in your inbox, then sign in.",
    user_already_exists: "An account may already exist for this email. Try signing in.",
    weak_password: "Choose a stronger password with at least 8 characters.",
    over_email_send_rate_limit: "Too many emails requested. Wait a few minutes before trying again.",
    over_request_rate_limit: "Too many attempts. Wait a few minutes and try again.",
    signup_disabled: "Registration is currently unavailable.",
    email_address_invalid: "Enter a valid email address.",
    email_address_not_authorized: "Email delivery is restricted for this project. The site owner needs to configure email delivery.",
    otp_expired: "This confirmation link has expired. Try signing in or register again to request a new confirmation."
  };
  return messages[error?.code] || "Could not complete the request. Check your connection and try again.";
}

document.querySelectorAll("[data-account-link]").forEach(link => { link.href = accountUrl().href; });
try {
  getHotelClient().auth.onAuthStateChange((event, session) => {
    document.querySelectorAll("[data-account-link]").forEach(link => {
      link.textContent = session ? "Account" : "Sign in";
    });
    if (event === "SIGNED_OUT") {
      try { sessionStorage.removeItem("bankhotel.demo.checkout"); sessionStorage.removeItem("bankhotel.booking.checkout"); sessionStorage.removeItem("bankhotel.booking.form"); } catch {}
    }
    // Keep callbacks synchronous; Supabase calls must be made outside this handler.
    document.dispatchEvent(new CustomEvent("hotel-auth-change", { detail: { event, session } }));
  });
} catch {
  // The account page displays a retryable error if the SDK could not load.
}
