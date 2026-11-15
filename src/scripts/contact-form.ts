export {};

interface TurnstileApi {
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const form = document.querySelector<HTMLFormElement>("#contact-form");
const phoneInput = document.querySelector<HTMLInputElement>("#contact-phone");
const status = document.querySelector<HTMLElement>("#contact-status");

function formatBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, "").slice(0, 13);

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length < 3) {
    return digits ? "(" + digits : "";
  }

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);

  if (number.length <= 4) {
    return "(" + ddd + ") " + number;
  }

  return (
    "(" +
    ddd +
    ") " +
    number.slice(0, number.length - 4) +
    "-" +
    number.slice(-4)
  );
}

function setStatus(
  message: string,
  state: "success" | "error" | "idle",
): void {
  if (!status) return;

  status.textContent = message;

  if (state === "idle") {
    delete status.dataset.state;
  } else {
    status.dataset.state = state;
  }
}

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = formatBrazilianPhone(phoneInput.value);
  });
}

if (form && form.dataset.ready === "true") {
  const endpoint = form.dataset.endpoint?.trim();
  const submitButton =
    form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const widget = form.querySelector(".cf-turnstile");

  if (
    widget &&
    !document.querySelector(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    )
  ) {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.append(script);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("", "idle");

    if (!endpoint || !form.reportValidity()) return;

    const formData = new FormData(form);
    const token = String(
      formData.get("cf-turnstile-response") ?? "",
    ).trim();

    if (!token) {
      setStatus("Complete the security check and try again.", "error");
      return;
    }

    // Garante que o token seja enviado com o nome esperado pelo Formspree.
    formData.set("cf-turnstile-response", token);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }

    setStatus("Seending...", "idle");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          errors?: Array<{ message?: string }>;
        };

        const validationErrors =
          result.errors
            ?.map((item) => item.message)
            .filter((message): message is string => Boolean(message))
            .join(" ") ?? "";

        throw new Error(
          result.error ||
            validationErrors ||
            "It could not be sent right now.",
        );
      }

      form.reset();
      window.turnstile?.reset();
      setStatus("Contact details sent. Thank you for your message.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to send. Please try again.",
        "error",
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    }
  });
}