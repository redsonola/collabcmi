export interface ThreeSetupProps {
  canvas: HTMLCanvasElement;
  setDebugData: (data: any) => void;
}

export interface ThreeSetup {
  cleanup: () => void;
  updateCanvasSize: (width: number, height: number) => void;
}

export type ThreeSetupFunction = (props: ThreeSetupProps) => ThreeSetup;