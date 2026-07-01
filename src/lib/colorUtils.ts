// Seeded pseudo-random number generator (Mulberry32)
function seededRandom(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function getDailyGradients() {
  const gradients = [
    {
      bg: "bg-gradient-to-r from-rose-200/70 to-pink-200/70",
      border: "border-pink-200/30",
      badge: "bg-pink-100/80 text-pink-700 border-pink-200/50"
    },
    {
      bg: "bg-gradient-to-r from-pink-200/60 to-purple-200/60",
      border: "border-purple-200/25",
      badge: "bg-purple-100/80 text-purple-700 border-purple-200/50"
    },
    {
      bg: "bg-gradient-to-r from-violet-200/60 to-fuchsia-200/60",
      border: "border-purple-200/30",
      badge: "bg-fuchsia-100/80 text-fuchsia-700 border-fuchsia-200/50"
    },
    {
      bg: "bg-gradient-to-r from-amber-200 to-orange-200",
      border: "border-orange-200/40",
      badge: "bg-amber-100/80 text-amber-700 border-amber-200/50"
    },
    {
      bg: "bg-gradient-to-r from-emerald-200/70 to-teal-200/70",
      border: "border-teal-200/30",
      badge: "bg-teal-100/80 text-teal-700 border-teal-200/50"
    },
    {
      bg: "bg-gradient-to-r from-sky-200/70 to-indigo-200/60",
      border: "border-indigo-200/30",
      badge: "bg-sky-100/80 text-sky-700 border-sky-200/50"
    }
  ];

  const today = new Date();
  // Format seed as "YYYY-MM-DD" for stable day-based seed
  const seedStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const rand = seededRandom(seedStr);

  // Seeded Fisher-Yates shuffle
  const shuffled = [...gradients];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
