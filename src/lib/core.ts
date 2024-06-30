import React from 'react';

export interface Shape{
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  backgroudColor: string;
  lineColor: string;
  angle: number;
  groupId?: string;
}

export type ShapeMouseEventHandler = (shapeId: string, mouseEvent: React.MouseEvent) => void;
// export type Drawer = React.FC<{
//   shape: Shape
//   onClick: ShapeMouseEvent;
//   onContextMenu: ShapeMouseEvent;
//   onClock: ShapeMouseEvent;
// }>;

// export type Selector = (shape: Shape) => Drawer | null;

export interface ShapeDriver{
  /** 対象のshapeの描画をサポートするかどうか。 */
  accept: (shape: Shape) => boolean;

  /** 表示のためのコンポーネントを取得する */
  viewerComponent: React.FC<{
    shape: Shape
    onClick?: ShapeMouseEventHandler;
    onContextMenu?: ShapeMouseEventHandler;
    onMousedown?: ShapeMouseEventHandler;
  }>;

}