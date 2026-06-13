type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

export type Leaves<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : "";

export const en = {
  nav: {
    home: "Home",
    play: "Play",
    stats: "Statistics",
    about: "About",
    highscores: "High Scores",
    wiki: "Wiki",
    news: "News",
    download: "Download",
    loginRegister: "Login/Register",
  },
  stats: {
    title: "Realm Status",
    accountsCreated: "Accounts Created",
    playersOnline: "Players Online",
    realmName: "Realm Name",
  },
  footer: {
    copyright: "2026 World of Claudecraft",
    githubLink: "https://github.com/levy-street/world-of-claudecraft",
    githubLabel: "Open Source Project",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
  },
  highscores: {
    title: "High Scores Leaderboard",
    desc: "Track the realm's greatest champions and compare your progress.",
  },
  wiki: {
    title: "Game Wiki & Guide",
    desc: "Discover the secrets of the realm, class guides, and strategies.",
  },
  news: {
    title: "News & Updates",
    desc: "Read the latest patch notes, events, and community updates.",
  },
  download: {
    title: "Download Desktop Launcher",
    desc: "Get the standalone launcher for optimized performance and full-screen play.",
  },
  comingSoon: {
    placeholder: "Coming Soon...",
    featureComingSoon: "This feature is coming soon to the realm.",
  },
};

export const es: typeof en = {
  nav: {
    home: "Inicio",
    play: "Jugar",
    stats: "Estadísticas",
    about: "Acerca de",
    highscores: "Clasificaciones",
    wiki: "Wiki",
    news: "Noticias",
    download: "Descargar",
    loginRegister: "Iniciar Sesión/Registrarse",
  },
  stats: {
    title: "Estado del Reino",
    accountsCreated: "Cuentas Creadas",
    playersOnline: "Jugadores en Línea",
    realmName: "Nombre del Reino",
  },
  footer: {
    copyright: "2026 World of Claudecraft",
    githubLink: "https://github.com/levy-street/world-of-claudecraft",
    githubLabel: "Proyecto de Código Abierto",
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
  },
  highscores: {
    title: "Clasificaciones de Puntuación",
    desc: "Sigue a los campeones más grandes del reino y compara tu progreso.",
  },
  wiki: {
    title: "Wiki y Guía del Juego",
    desc: "Descubre los secretos del reino, guías de clase y estrategias.",
  },
  news: {
    title: "Noticias y Actualizaciones",
    desc: "Lee las últimas notas del parche, eventos y noticias de la comunidad.",
  },
  download: {
    title: "Descargar Lanzador de Escritorio",
    desc: "Consigue el lanzador independiente para un rendimiento optimizado y juego a pantalla completa.",
  },
  comingSoon: {
    placeholder: "Próximamente...",
    featureComingSoon: "Esta característica llegará pronto al reino.",
  },
};

const translations = { en, es };

let currentLanguage: "en" | "es" = "en";

// Initialize language from localStorage if available (browser environments)
if (typeof localStorage !== "undefined") {
  const saved = localStorage.getItem("locale");
  if (saved === "en" || saved === "es") {
    currentLanguage = saved;
  }
}

export function getLanguage(): "en" | "es" {
  return currentLanguage;
}

export function setLanguage(lang: "en" | "es"): void {
  currentLanguage = lang;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("locale", lang);
  }
}

export function t(key: Leaves<typeof en>): string {
  const parts = key.split(".");
  let current: any = translations[currentLanguage];
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = current[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}
