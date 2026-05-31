export type EntityType =
  | "line"
  | "circle"
  | "arc"
  | "rectangle"
  | "polyline"
  | "text"
  | "dimension"
  | "ellipse";

export interface BaseEntity {
  id: string;
  type: EntityType;
  layerId: string;
  color?: string;
  lineWidth?: number;
}

export interface LineEntity extends BaseEntity {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectangleEntity extends BaseEntity {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleEntity extends BaseEntity {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
}

export interface PolylineEntity extends BaseEntity {
  type: "polyline";
  points: { x: number; y: number }[];
  closed: boolean;
}

export interface ArcEntity extends BaseEntity {
  type: "arc";
  cx: number;
  cy: number;
  radius: number;
  startAngle: number; // radian
  endAngle: number; // radian
}

export interface DimensionEntity extends BaseEntity {
  type: "dimension";
  dimType: "linear" | "aligned";
  x1: number;
  y1: number; // titik ukur pertama
  x2: number;
  y2: number; // titik ukur kedua
  dx: number;
  dy: number; // offset garis dimensi dari titik ukur
  text?: string; // override teks, kosong = auto hitung
}

export interface TextEntity extends BaseEntity {
  type: "text";
  x: number;
  y: number;
  text: string; // content, supports multi-line with \n
  fontSize: number; // default 2.5 in world units
  fontFamily: string; // default "Arial"
  rotation: number; // radians, default 0
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right";
  lineHeight: number; // multiplier, default 1.5
}

export interface EllipseEntity extends BaseEntity {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number; // semi-axis X
  ry: number; // semi-axis Y
  rotation: number; // radians
}

export type CADEntity =
  | LineEntity
  | RectangleEntity
  | CircleEntity
  | PolylineEntity
  | ArcEntity
  | DimensionEntity
  | TextEntity
  | EllipseEntity;
