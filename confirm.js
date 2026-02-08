const stateConfig = {
  success: {
    title: "Confirmed. You’re in.",
    body: "You’re subscribed successfully. Your first update will land soon.",
    cta: "Back to JetSignal",
    ctaHref: "index.html",
    showResend: false,
  },
  already: {
    title: "You’re already onboard.",
    body: "Looks like this email is already confirmed. Thanks for coming back.",
    cta: "Back to JetSignal",
    ctaHref: "index.html",
    showResend: false,
  },
  expired: {
    title: "This link expired.",
    body: "No worries—request a fresh confirmation link and we’ll resend it.",
    cta: "Back to JetSignal",
    ctaHref: "index.html",
    showResend: true,
  },
};

const params = new URLSearchParams(window.location.search);
const state = params.get("state") || "success";
const config = stateConfig[state] || stateConfig.success;

const title = document.getElementById("confirm-title");
const body = document.getElementById("confirm-body");
const cta = document.getElementById("confirm-cta");
const resendButton = document.getElementById("resend-button");

title.textContent = config.title;
body.textContent = config.body;
cta.textContent = config.cta;
cta.href = config.ctaHref;

if (!config.showResend) {
  resendButton.classList.add("is-hidden");
} else {
  resendButton.addEventListener("click", () => {
    window.location.href = "index.html#resend";
  });
}
