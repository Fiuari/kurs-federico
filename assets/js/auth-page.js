const authForm = document.getElementById("auth-form");
const authStatus = document.getElementById("auth-status");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const repeatPassword = document.getElementById("repeat-password");
const fullName = document.getElementById("full-name");
const authSubmit = document.getElementById("auth-submit");
const signOutButton = document.getElementById("sign-out");
const retrySession = document.getElementById("retry-session");
const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.slice(1));
let registerMode = false;
let requestRunning = false;

// Only predefined destinations are accepted; URL parameters cannot redirect off-site.
const destination = new URL(params.get("next") === "admin" ? "admin.html" : params.get("next") === "booking" ? "booking.html" : "index.html", hotelRoot);
if (params.get("next") === "booking" && /^[a-z0-9-]+$/.test(params.get("room") || "")) {
  destination.searchParams.set("room", params.get("room"));
}
document.getElementById("continue").href = destination.href;

function displayAccount(user) {
  document.getElementById("signed-in").hidden = !user;
  document.getElementById("signed-out").hidden = !!user;
  document.getElementById("account-email").textContent = user?.email || "";
  document.getElementById("account-title").textContent = user ? "Your account" : registerMode ? "Create account" : "Welcome back";
}
function setMode(register) {
  registerMode = register;
  authForm.reset();
  fullName.setCustomValidity("");
  repeatPassword.setCustomValidity("");
  for (const id of ["name-label", "repeat-label", "registration-note"]) document.getElementById(id).hidden = !register;
  fullName.required = register;
  repeatPassword.required = register;
  authPassword.minLength = register ? 8 : 1;
  authPassword.autocomplete = register ? "new-password" : "current-password";
  document.getElementById("login-mode").setAttribute("aria-pressed", String(!register));
  document.getElementById("register-mode").setAttribute("aria-pressed", String(register));
  authSubmit.textContent = register ? "Create account" : "Sign in";
  authStatus.textContent = "";
  displayAccount(null);
}
function busy(value) {
  requestRunning = value;
  authSubmit.disabled = value;
  signOutButton.disabled = value;
  document.getElementById("login-mode").disabled = value;
  document.getElementById("register-mode").disabled = value;
}
async function checkSession() {
  retrySession.hidden = true;
  authStatus.textContent = "Checking your session…";
  try {
    const client = getHotelClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    displayAccount(data.session?.user);
    authStatus.textContent = data.session ? "You are signed in." : "";
    if (hashParams.has("error")) {
      authStatus.textContent = authErrorMessage({ code: hashParams.get("error_code") });
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (error) {
    displayAccount(null);
    authStatus.textContent = authErrorMessage(error);
    retrySession.hidden = false;
  }
}
document.getElementById("login-mode").addEventListener("click", () => setMode(false));
document.getElementById("register-mode").addEventListener("click", () => setMode(true));
fullName.addEventListener("input", () => fullName.setCustomValidity(""));
repeatPassword.addEventListener("input", () => repeatPassword.setCustomValidity(""));
authPassword.addEventListener("input", () => repeatPassword.setCustomValidity(""));
retrySession.addEventListener("click", () => location.reload());
document.addEventListener("hotel-auth-change", ({ detail }) => {
  displayAccount(detail.session?.user);
  if (!requestRunning) authStatus.textContent = detail.session ? "You are signed in." : "";
});
authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (requestRunning) return;
  if (registerMode) {
    fullName.setCustomValidity(fullName.value.trim() ? "" : (globalThis.HotelI18n?.t("Enter your full name.") || "Enter your full name."));
    repeatPassword.setCustomValidity(authPassword.value === repeatPassword.value ? "" : (globalThis.HotelI18n?.t("Passwords do not match.") || "Passwords do not match."));
    if (!authForm.reportValidity()) return;
  }
  busy(true);
  authStatus.textContent = registerMode ? "Creating your account…" : "Signing in…";
  try {
    const client = getHotelClient();
    const credentials = { email: authEmail.value.trim(), password: authPassword.value };
    let result;
    if (registerMode) {
      // Use an exact callback URL that can be allowed in Supabase URL Configuration.
      result = await client.auth.signUp({
        ...credentials,
        options: { emailRedirectTo: new URL("auth.html", hotelRoot).href, data: { full_name: fullName.value.trim() } }
      });
    } else {
      result = await client.auth.signInWithPassword(credentials);
    }
    if (result.error) throw result.error;
    authPassword.value = "";
    repeatPassword.value = "";
    if (result.data.session) {
      location.replace(destination.href);
    } else {
      authStatus.textContent = "Check your email for a confirmation link. If this address already has an account, sign in. Check your spam folder too.";
    }
  } catch (error) {
    authStatus.textContent = authErrorMessage(error);
  } finally {
    busy(false);
  }
});
signOutButton.addEventListener("click", async () => {
  if (requestRunning) return;
  busy(true);
  authStatus.textContent = "Signing out…";
  try {
    const { error } = await getHotelClient().auth.signOut({ scope: "local" });
    if (error) throw error;
    displayAccount(null);
    authForm.reset();
    authStatus.textContent = "You have signed out.";
  } catch (error) { authStatus.textContent = authErrorMessage(error); }
  finally { busy(false); }
});
checkSession();
