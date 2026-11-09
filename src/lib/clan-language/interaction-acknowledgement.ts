import { clanCopy } from "./core"

export const getInteractionAcknowledgementMessages = clanCopy({
    en: {
        working: "Working…",
        ready: "Your form is ready.",
        open: "Open form",
        expired: "This form expired. Please start again.",
    },
    cs: {
        working: "Pracuji…",
        ready: "Formulář je připravený.",
        open: "Otevřít formulář",
        expired: "Platnost formuláře vypršela. Začni prosím znovu.",
    },
    de: {
        working: "Wird bearbeitet…",
        ready: "Dein Formular ist bereit.",
        open: "Formular öffnen",
        expired: "Dieses Formular ist abgelaufen. Bitte starte erneut.",
    },
    pl: {
        working: "Przetwarzanie…",
        ready: "Formularz jest gotowy.",
        open: "Otwórz formularz",
        expired: "Formularz wygasł. Zacznij ponownie.",
    },
})
