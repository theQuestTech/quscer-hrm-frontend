// Two-step sign-in helpers: the "Confirm it's you" box, remembered computers,
// and whether the current sign-in still has to set it up.

export const CODE_REQUIRED = "TWO_STEP_CODE_REQUIRED";
export const CODE_WRONG = "TWO_STEP_CODE_WRONG";
export const SETUP_REQUIRED = "TWO_STEP_SETUP_REQUIRED";

type Asker = (message: string, error: string | null) => Promise<string | null>;
let asker: Asker | null = null;

// <CodePrompt /> registers itself here; api() asks through it.
export function setCodeAsker(fn: Asker | null) {
  asker = fn;
}
export function askCode(message: string, error: string | null = null): Promise<string | null> {
  return asker ? asker(message, error) : Promise.resolve(window.prompt(`${message}${error ? `\n${error}` : ""}`));
}

// True when this sign-in must set up two-step before anything else opens.
export function tokenNeedsSetup(token: string | null): boolean {
  if (!token) return false;
  try {
    return !!JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).tsr;
  } catch {
    return false;
  }
}

// "Trust this computer for 30 days" — one token per email on this browser.
const TRUST_KEY = "quscer-hrm-trusted-device";
export function trustedToken(email: string): string | undefined {
  try {
    return JSON.parse(localStorage.getItem(TRUST_KEY) ?? "{}")[email.toLowerCase()];
  } catch {
    return undefined;
  }
}
export function saveTrustedToken(email: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(TRUST_KEY) ?? "{}");
    all[email.toLowerCase()] = token;
    localStorage.setItem(TRUST_KEY, JSON.stringify(all));
  } catch {
    // private browsing — they'll just be asked for a code next time
  }
}
export function forgetTrustedTokens() {
  try {
    localStorage.removeItem(TRUST_KEY);
  } catch {
    /* ignore */
  }
}
