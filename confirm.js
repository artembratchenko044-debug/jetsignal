const stateConfig = {
  success: {
    title: "Confirmed. You’re in.",
    body: "You’re subscribed successfully. Your first update will land soon.",
    cta: "Back to JetSignal",
    ctaHref: "/",
    showResend: false,
  },
  already: {
    title: "You’re already onboard.",
    body: "Looks like this email is already confirmed. Thanks for coming back.",
    cta: "Back to JetSignal",
    ctaHref: "/",
    showResend: false,
  },
  expired: {
    title: "This link expired.",
    body: "No worries—request a fresh confirmation link and we’ll resend it.",
    cta: "Back to JetSignal",
    ctaHref: "/",
    showResend: true,
  },
};

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const applyState = (state) => {
  const config = stateConfig[state] || stateConfig.success;
  title.textContent = config.title;
  body.textContent = config.body;
  cta.textContent = config.cta;
  cta.href = config.ctaHref;

  if (!config.showResend) {
    resendButton.classList.add("is-hidden");
  } else {
    resendButton.classList.remove("is-hidden");
  }
};

const title = document.getElementById("confirm-title");
const body = document.getElementById("confirm-body");
const cta = document.getElementById("confirm-cta");
const resendButton = document.getElementById("resend-button");

resendButton.addEventListener("click", () => {
  window.location.href = "/#resend";
});

const confirmEmail = async () => {
  if (!token) {
    applyState("expired");
    return;
  }

  try {
    const response = await fetch(
      "https://wuhbaxesacmsdrrxzeuy.supabase.co/functions/v1/confirm-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Request failed");

    applyState(data.status || "success");
  } catch (error) {
    console.error("Confirmation error:", error);
    applyState("expired");
  }
};

confirmEmail();
