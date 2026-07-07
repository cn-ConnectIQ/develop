export { ReelOfHonor, buildReelColumns, resolveReelFinalIndices, DEFAULT_REEL_STOP_SEQUENCE } from "@/components/screen/lottery-animations/ReelOfHonor";
export {
  StarlightOrbit,
  resolveOrbitWinnerIndex,
  resolveOrbitStopAngle,
} from "@/components/screen/lottery-animations/StarlightOrbit";
export {
  PrecisionRoller,
  buildPrecisionRollerConfig,
  buildRollerStopSequence,
} from "@/components/screen/lottery-animations/PrecisionRoller";
export {
  ScrollUnveiling,
  calcScrollUnveilingDuration,
} from "@/components/screen/lottery-animations/ScrollUnveiling";
export { RollingMachine } from "@/components/screen/lottery-animations/RollingMachine";
export { SpotlightScroll } from "@/components/screen/lottery-animations/SpotlightScroll";
export {
  LotteryAnimationDispatch,
  useLotteryScreenAnimation,
} from "@/components/screen/lottery-animations/LotteryAnimationDispatch";
export { WinnerResultCard } from "@/components/screen/lottery-animations/WinnerResultCard";
export { WinnerGridReveal } from "@/components/screen/lottery-animations/WinnerGridReveal";
export type {
  ReelColumnEntry,
  ReelOfHonorPhase,
  ReelOfHonorProps,
  ReelWinnerInfo,
  StarlightOrbitEntry,
  StarlightOrbitPhase,
  StarlightOrbitProps,
  PrecisionRollerPhase,
  PrecisionRollerProps,
  ScrollUnveilingPhase,
  ScrollUnveilingProps,
  LotteryAnimationPhase,
  LotteryAnimationProps,
} from "@/components/screen/lottery-animations/types";
