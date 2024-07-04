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
}

export interface Group extends Shape{
  type: "group";
  shapes: Shape[];
}

export function isGroup(arg: any): arg is Group {
  return arg.type === "group";
}

export function findShape(shapes: Shape[], id: string): Shape | undefined{
  //■直下のshapeから検索
  const result = shapes.find(item => item.id === id);
  if(result != null)
    return result;

  //■グループから検索
  if(result == null){
    const groups = shapes.filter(item => isGroup(item)) as any as Group[];
    for (const group of groups) {
      const result = findShape(group.shapes, id);
      if(result != null)
        return result;
    }
  }
  return undefined;
}

export function findTopGroup(shapes: Shape[], id: string): Group | undefined{
  const topGroups = shapes.filter(item => isGroup(item)) as Group[];
  return topGroups.find(item => findShape(item.shapes, id) != null);
}

/**
 * グループに含まれるshapeからサイズを収集し、自身を書き換える
 * @param group 
 * @param data 
 */
export function ajustGroup(group: Group): void{
  const data =  {left: Number.MAX_SAFE_INTEGER, right: Number.MIN_SAFE_INTEGER, top: Number.MAX_SAFE_INTEGER, bottom: Number.MIN_SAFE_INTEGER};

  //■グループのサイズ情報を収集
  group.shapes.forEach(shape => {
    //■グループの場合は再帰的に処理
    if(isGroup(shape)){
      ajustGroup(shape);
    }

    //■交換
    if(data.left > shape.left)
      data.left = shape.left;
    if(data.right < shape.left + shape.width)
      data.right = shape.left + shape.width;
    if(data.top > shape.top)
      data.top = shape.top;
    if(data.bottom < shape.top + shape.height)
      data.bottom = shape.top + shape.height;
  });

  //■自身のサイズ情報を更新
  if(data.left < data.right && data.top < data.bottom){
    group.left = data.left;
    group.width = data.right - data.left;
    group.top = data.top;
    group.height = data.bottom - data.top;
  }
}

export type ShapeMouseEventHandler = (shapeId: string, mouseEvent: React.MouseEvent) => void;

/**
 * Shpaeを描画するためのコンポーネント
 */
export type ShapeViewerComponent = React.FC<{
  shape: Shape
  onClick?: ShapeMouseEventHandler;
  onContextMenu?: ShapeMouseEventHandler;
  onMousedown?: ShapeMouseEventHandler;
}>;

export interface ShapeDriver{
  /** 対象のshapeの描画をサポートするかどうか。 */
  accept: (shape: Shape) => boolean;

  /** 表示のためのコンポーネントを取得する */
  viewerComponent: ShapeViewerComponent;

}