// The figure kit (plan A5, Stage 3). Every chart on the site is drawn from
// these; scripts/guard.mjs fails a new chart that stretches its own lines.
export { Frame, Marker, LastValue, LineLabel, RampLegend, Legend, SourceChip, pathOf } from "./frame";
export type { Axis, Box, Plot, LegendItem, Source } from "./frame";
export {
  CurveFigure,
  SeriesFigure,
  HistogramFigure,
  LatticeFigure,
  FoldStripsFigure,
  CashLadderFigure,
  IterationFigure,
  MatrixFigure,
  DepthLadderFigure,
} from "./templates";
export type { Role, CurveLine, FoldKind } from "./templates";
export { SurfaceFigure } from "./Surface";
