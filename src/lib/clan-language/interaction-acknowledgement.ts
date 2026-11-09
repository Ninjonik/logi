import { clanCopy } from "./core"

export const getInteractionAcknowledgementMessages = clanCopy({
    fr: {
        working: "Traitement en cours…",
        ready: "Ton formulaire est prêt.",
        open: "Ouvrir le formulaire",
        expired: "Ce formulaire a expiré. Recommence.",
    },
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
