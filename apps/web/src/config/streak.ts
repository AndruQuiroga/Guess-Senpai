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
    frameGradient: "bg-amber-400",
  },
  {
    threshold: 7,
    title: "Weekly Rhythm",
    rewardName: "Aurora Sweep Frame",
    rewardDescription:
      "A soothing teal-to-violet sweep that highlights a full week of wins.",
    frameGradient: "bg-cyan-400",
  },
  {
    threshold: 14,
    title: "Two-Week Tempo",
    rewardName: "Neon Pulse Frame",
    rewardDescription:
      "Vibrant magenta flares that celebrate holding momentum for fourteen days.",
    frameGradient: "bg-fuchsia-400",
  },
  {
    threshold: 30,
    title: "Monthly Mastery",
    rewardName: "Starlit Horizon Frame",
    rewardDescription:
      "Shimmering starlight arcs that mark a full month of perfect attendance.",
    frameGradient: "bg-emerald-400",
  },
  {
    threshold: 50,
    title: "Glittering Resolve",
    rewardName: "Prismatic Crest Frame",
    rewardDescription:
      "A prismatic halo for the truly committed streak chaser.",
    frameGradient: "bg-violet-400",
  },
  {
    threshold: 100,
    title: "Centennial Legend",
    rewardName: "Celestial Crown Frame",
    rewardDescription:
      "A radiant crown reserved for those who never miss a day.",
    frameGradient: "bg-yellow-300",
  },
];
