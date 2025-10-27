export interface StreakMilestone {
  threshold: number;
  title: string;
  rewardName: string;
  rewardDescription: string;
  frameGradient: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    threshold: 3,
    title: "Spark of Dedication",
    rewardName: "Ember Loop Frame",
    rewardDescription:
      "A warm amber glow that wraps your avatar to celebrate getting started.",
    frameGradient: "from-amber-400/80 via-orange-500/60 to-rose-400/80",
  },
  {
    threshold: 7,
    title: "Weekly Rhythm",
    rewardName: "Aurora Sweep Frame",
    rewardDescription:
      "A soothing teal-to-violet sweep that highlights a full week of wins.",
    frameGradient: "from-cyan-400/80 via-sky-500/60 to-indigo-500/70",
  },
  {
    threshold: 14,
    title: "Two-Week Tempo",
    rewardName: "Neon Pulse Frame",
    rewardDescription:
      "Vibrant magenta flares that celebrate holding momentum for fourteen days.",
    frameGradient: "from-fuchsia-400/80 via-purple-500/60 to-rose-500/80",
  },
  {
    threshold: 30,
    title: "Monthly Mastery",
    rewardName: "Starlit Horizon Frame",
    rewardDescription:
      "Shimmering starlight arcs that mark a full month of perfect attendance.",
    frameGradient: "from-emerald-400/80 via-teal-500/60 to-blue-500/70",
  },
  {
    threshold: 50,
    title: "Glittering Resolve",
    rewardName: "Prismatic Crest Frame",
    rewardDescription:
      "A prismatic halo for the truly committed streak chaser.",
    frameGradient: "from-violet-400/80 via-amber-300/60 to-sky-500/70",
  },
  {
    threshold: 100,
    title: "Centennial Legend",
    rewardName: "Celestial Crown Frame",
    rewardDescription:
      "A radiant crown reserved for those who never miss a day.",
    frameGradient: "from-yellow-300/80 via-rose-400/70 to-purple-500/80",
  },
];
