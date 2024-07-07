import { forEach } from 'lodash';
import React from 'react';
import { Matrix, applyToPoint, compose, rotateDEG } from 'transformation-matrix';

const MIN_SHAPE_SIZE = 30;
/** shapeを表す型 */
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

/** groupを表す型 */
export interface Group extends Shape{
  type: "group";
  shapes: Shape[];
}

/** groupかどうかを判定する */
export function isGroup(arg: any): arg is Group {
  return arg.type === "group";
}

/**
 * shapesから、group内のshapeも含めて、shapeを検索する
 * @param shapes 
 * @param id 
 * @returns 
 */
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

/** shpaeが所属する一番上のレベルのgroupを取得する。 */
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

/**
 * Shapeに対するマウスイベントハンドラ
 */
export type ShapeMouseEventHandler = (shapeId: string, mouseEvent: React.MouseEvent) => void;

/** サイズ変更のコマンドの種類 */
export type ResizeCommand = "nw-resize" | "n-resize" | "ne-resize" | "e-resize" | "se-resize" | "s-resize" | "sw-resize" | "sw-resize" | "w-resize";

/**
 * 移動の際、shpaeで固定されるポイントを取得する
 * @param shape 
 * @param command 
 * @returns 
 */
function getFixedPointWhenMove(shape: Shape, command: ResizeCommand) {
  switch(command){
    case "nw-resize": return {x: shape.left + shape.width, y: shape.top + shape.height};
    case "n-resize": return {x: shape.left, y: shape.top + shape.height};
    case "ne-resize": return {x: shape.left, y: shape.top + shape.height};
    case "e-resize": return{x: shape.left, y: shape.top};
    case "se-resize": return{x: shape.left, y: shape.top};
    case "s-resize": return{x: shape.left, y: shape.top};
    case "sw-resize": return{x: shape.left + shape.width, y: shape.top};
    case "w-resize": return{x: shape.left + shape.width, y: shape.top};
    default: throw Error();
  }
}
/**
 * shapeを移動する
 * @param shapes 
 * @param shape 
 * @param add 
 * @param resizeCommand 
 */
export function moveShape(shapes: Shape[], shape: Shape, additional:{left: number, top: number}){
  const originalShape = findShape(shapes, shape.id);
  if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);
  
  shape.left = (originalShape.left) + additional.left;
  shape.top = (originalShape.top) + additional.top;
  if(isGroup(shape)){
    shape.shapes.forEach(item => {
      moveShape(shapes, item, additional);
    });
  }
}
/**
 * shapeのサイズを変更する
 * @param shapes 
 * @param shape 
 * @param additional 
 * @param command 
 */
export function resizeShape(shapes: Shape[], shape: Shape, additional:{width: number, height: number}, command: ResizeCommand){
  const originalShape = findShape(shapes, shape.id);
  if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);
  
  //■サイズの調整
  const [additionalWidth, additioalHeight] = (() => [
    originalShape.width + additional.width >= MIN_SHAPE_SIZE ? additional.width : MIN_SHAPE_SIZE - originalShape.width,
    originalShape.height + additional.height >= MIN_SHAPE_SIZE ? additional.height : MIN_SHAPE_SIZE - originalShape.height,
  ])();
  //■サイズの変更  
  shape.width = originalShape.width + additionalWidth;
  shape.height = originalShape.height + additioalHeight;

  //■リサイズ方向によるleftTopの調整(左向きの場合はxをサイズ分マイナス / 上向きの場合はyをサイズ分マイナス)
  shape.left = originalShape.left - (command === "nw-resize" || command === "w-resize" || command === "sw-resize" ? additionalWidth : 0);
  shape.top = originalShape.top - (command === "nw-resize" || command === "n-resize" || command === "ne-resize" ? additioalHeight : 0);

  //■shapeの回転に伴うleft,topの調整
  if(shape.angle !== 0){
    //■オリジナルのshapeを回転したうえで、固定されるべきPointを取得
    const routatedOriginalPoint = (() => {
      const matrix = compose(rotateDEG(originalShape.angle, originalShape.left + originalShape.width / 2, originalShape.top + originalShape.height / 2));
      const point = getFixedPointWhenMove(originalShape, command);
      return applyToPoint(matrix, point);
    })();

    //■変更後のshapeを開店したうえで、固定されるべきPointを取得
    const routatedNewPoint = (() => {
      const matrix = compose(rotateDEG(shape.angle, shape.left + shape.width / 2, shape.top + shape.height / 2));
      const point = getFixedPointWhenMove(shape, command);
      return applyToPoint(matrix, point);
    })();

     //■固定されるべきPointの変更が内容、上記2点の差分で補正
     shape.left = shape.left - (routatedNewPoint.x - routatedOriginalPoint.x);
     shape.top = shape.top - (routatedNewPoint.y - routatedOriginalPoint.y);
  }

  //■グループアイテムの再帰処理
  if(isGroup(shape)){
    shape.shapes.forEach(item => {resizeShape(shapes, item, {width: additionalWidth, height: additioalHeight}, command)});
  }
}
export function routeShape(shapes: Shape[], shape: Shape, additional:{angle: number}){
  const originalShape = findShape(shapes, shape.id);
  if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);

  shape.angle = originalShape.angle + additional.angle; 

  if(isGroup(shape)){
    const matrix = compose(rotateDEG(additional.angle, shape.left + shape.width / 2, shape.top + shape.height / 2));
    _routeShape(shapes, shape, matrix);
  }
}
function _routeShape(shapes: Shape[], group: Group, matrix: Matrix){
 
  group.shapes.forEach(shape => {
   
    const originalShape = findShape(shapes, shape.id);
    if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);

    //■shapeの回転後の座標を得る
    const shapeCenterPoint = {x: originalShape.left + originalShape.width / 2, y: originalShape.top + originalShape.height / 2};
    const shapeMatrix = compose(rotateDEG(originalShape.angle, shapeCenterPoint.x, shapeCenterPoint.y));
    const shapeLeftTopPoint = applyToPoint(shapeMatrix, {x: originalShape.left, y: originalShape.top});
    //■親のgroupの回転を反映
    const routedLeftTopPoint = applyToPoint(matrix, shapeLeftTopPoint);
    const routedCenterPoint = applyToPoint(matrix, shapeCenterPoint);
    //■角度の算出
    const startRadian = Math.atan2(originalShape.top - shapeCenterPoint.y, originalShape.left - shapeCenterPoint.x);
    const endRadian = Math.atan2(routedLeftTopPoint.y - routedCenterPoint.y, routedLeftTopPoint.x - routedCenterPoint.x);
    const angle = (((endRadian - startRadian) * 180) / Math.PI);
    //■角度を戻して、left-top座標を算出
    const beforeRoutedMatrix = compose(rotateDEG(angle * -1, routedCenterPoint.x, routedCenterPoint.y));
    const beforeRoutedPoint = applyToPoint(beforeRoutedMatrix, routedLeftTopPoint);
    //■値の反映
    shape.angle = angle;
    shape.left = beforeRoutedPoint.x;
    shape.top = beforeRoutedPoint.y;

    //対象がグループの時は再帰
    if(isGroup(shape)){
      _routeShape(shapes, shape, matrix);
    }
  });
}

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