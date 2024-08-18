import { forEach } from 'lodash';
import React from 'react';
import { Matrix, applyToPoint, compose, rotateDEG } from 'transformation-matrix';

const MIN_SHAPE_SIZE = 30;
export interface Connector{
  
}
export interface Point{
  left: number;
  top: number;
}
export interface Surface{
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  backgroudColor: string;
}
/** shapeを表す型 */
export interface Shape{
  id: string;
  type: string;
  surface?: Surface;
  line: {
    color: string;
  };
  points?: Point[];
  
}

/** groupを表す型 */
export interface Group extends Shape{
  type: "group";
  surface: Surface;
  shapes: Shape[];
}

/** groupかどうかを判定する */
export function isGroup(arg: any): arg is Group {
  return arg.type === "group" && arg.surface != null && arg.shapes != null;
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
    if(shape.surface != null){//surfaceのとき
      if(data.left > shape.surface.left)
        data.left = shape.surface.left;
      if(data.right < shape.surface.left + shape.surface.width)
        data.right = shape.surface.left + shape.surface.width;
      if(data.top > shape.surface.top)
        data.top = shape.surface.top;
      if(data.bottom < shape.surface.top + shape.surface.height)
        data.bottom = shape.surface.top + shape.surface.height;
    }
    else if(shape.points != null){//surfaceではないときは、pointを加味する
      shape.points.forEach(point => {
        if(data.left > point.left)
          data.left = point.left;
        if(data.right < point.left)
          data.right = point.left;
        if(data.top > point.top)
          data.top = point.top;
        if(data.bottom < point.top)
          data.bottom = point.top;
      });
    }
  });

  //■自身のサイズ情報を更新
  if(data.left < data.right && data.top < data.bottom){
    group.surface.left = data.left;
    group.surface.width = data.right - data.left;
    group.surface.top = data.top;
    group.surface.height = data.bottom - data.top;
  }
}

/**
 * Shapeに対するマウスイベントハンドラ
 */
export type ShapeMouseEventHandler = (shapeId: string, mouseEvent: React.MouseEvent, option?: any) => void;

/** サイズ変更のコマンドの種類 */
export type ResizeCommandType = "nw-resize" | "n-resize" | "ne-resize" | "e-resize" | "se-resize" | "s-resize" | "sw-resize" | "sw-resize" | "w-resize";
export type CommandType = ResizeCommandType | "move" | "move-point";

/**
 * 移動の際、shpaeで固定されるポイントを取得する
 * @param shape 
 * @param command 
 * @returns 
 */
function getFixedPointWhenResize(surface: Surface, command: ResizeCommandType) {
  
  switch(command){
    case "nw-resize": return {x: surface.left + surface.width, y: surface.top + surface.height};
    case "n-resize": return {x: surface.left, y: surface.top + surface.height};
    case "ne-resize": return {x: surface.left, y: surface.top + surface.height};
    case "e-resize": return{x: surface.left, y: surface.top};
    case "se-resize": return{x: surface.left, y: surface.top};
    case "s-resize": return{x: surface.left, y: surface.top};
    case "sw-resize": return{x: surface.left + surface.width, y: surface.top};
    case "w-resize": return{x: surface.left + surface.width, y: surface.top};
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
  
  //■面の移動
  if(originalShape.surface != null && shape.surface != null){
    shape.surface.left = (originalShape.surface.left) + additional.left;
    shape.surface.top = (originalShape.surface.top) + additional.top;
    if(isGroup(shape)){
      shape.shapes.forEach(item => {
        moveShape(shapes, item, additional);
      });
    }
  }
  //■ポイントの移動
  (shape.points ?? []).forEach((point, index) => {
    if(originalShape.points != null){
      point.left = (originalShape.points[index].left) + additional.left;
      point.top = (originalShape.points[index].top) + additional.top;
    }
  });

}
/**
 * shapeのサイズを変更する
 * @param shapes 
 * @param shape 
 * @param additional 
 * @param command 
 */
export function resizeShape(shapes: Shape[], shape: Shape, additional:{width: number, height: number}, command: ResizeCommandType){
  const originalShape = findShape(shapes, shape.id);
  if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);
  if(originalShape.surface != null && shape.surface != null){
    //■サイズの調整
    const [additionalWidth, additioalHeight] = (() => [
      originalShape.surface.width + additional.width >= MIN_SHAPE_SIZE ? additional.width : MIN_SHAPE_SIZE - originalShape.surface.width,
      originalShape.surface.height + additional.height >= MIN_SHAPE_SIZE ? additional.height : MIN_SHAPE_SIZE - originalShape.surface.height,
    ])();
    //■サイズの変更  
    shape.surface.width = originalShape.surface.width + additionalWidth;
    shape.surface.height = originalShape.surface.height + additioalHeight;

    //■リサイズ方向によるleftTopの調整(左向きの場合はxをサイズ分マイナス / 上向きの場合はyをサイズ分マイナス)
    shape.surface.left = originalShape.surface.left - (command === "nw-resize" || command === "w-resize" || command === "sw-resize" ? additionalWidth : 0);
    shape.surface.top = originalShape.surface.top - (command === "nw-resize" || command === "n-resize" || command === "ne-resize" ? additioalHeight : 0);

    //■shapeの回転に伴うleft,topの調整
    if(shape.surface.angle !== 0){
      //■オリジナルのshapeを回転したうえで、固定されるべきPointを取得
      const routatedOriginalPoint = (() => {
        const matrix = compose(rotateDEG(originalShape.surface.angle, originalShape.surface.left + originalShape.surface.width / 2, originalShape.surface.top + originalShape.surface.height / 2));
        const point = getFixedPointWhenResize(originalShape.surface, command);
        return applyToPoint(matrix, point);
      })();

      //■変更後のshapeを開店したうえで、固定されるべきPointを取得
      const routatedNewPoint = (() => {
        const matrix = compose(rotateDEG(shape.surface.angle, shape.surface.left + shape.surface.width / 2, shape.surface.top + shape.surface.height / 2));
        const point = getFixedPointWhenResize(shape.surface, command);
        return applyToPoint(matrix, point);
      })();

      //■固定されるべきPointの変更が内容、上記2点の差分で補正
      shape.surface.left = shape.surface.left - (routatedNewPoint.x - routatedOriginalPoint.x);
      shape.surface.top = shape.surface.top - (routatedNewPoint.y - routatedOriginalPoint.y);
    }
    //■グループアイテムの再帰処理
    if(isGroup(shape)){
      shape.shapes.forEach(item => {resizeShape(shapes, item, {width: additionalWidth, height: additioalHeight}, command)});
      // ajustGroup(shape);
    }
  }
}
export function routeShape(shapes: Shape[], shape: Shape, additional:{angle: number}){
  const originalShape = findShape(shapes, shape.id);
  if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);
  if(originalShape.surface != null && shape.surface != null){
    shape.surface.angle = originalShape.surface.angle + additional.angle; 

    if(isGroup(shape)){
      const matrix = compose(rotateDEG(additional.angle, shape.surface.left + shape.surface.width / 2, shape.surface.top + shape.surface.height / 2));
      _routeShape(shapes, shape, matrix);
    }
  }
}
function _routeShape(shapes: Shape[], group: Group, matrix: Matrix){
 
  group.shapes.forEach(shape => {
    const originalShape = findShape(shapes, shape.id);
    if(originalShape == null)throw new Error(`shapeが見つからない。shapeId=${shape.id}`);

    //■surfaceの回転
    if(originalShape.surface != null){//surfaceのとき
      if(shape.surface == null)throw Error("originalShape.surfaceが存在するのに、shape.surfaceが存在しない。");
      //■shapeの回転後の座標を得る
      const shapeCenterPoint = {x: originalShape.surface.left + originalShape.surface.width / 2, y: originalShape.surface.top + originalShape.surface.height / 2};
      const shapeMatrix = compose(rotateDEG(originalShape.surface.angle, shapeCenterPoint.x, shapeCenterPoint.y));
      const shapeLeftTopPoint = applyToPoint(shapeMatrix, {x: originalShape.surface.left, y: originalShape.surface.top});
      //■親のgroupの回転を反映
      const routedLeftTopPoint = applyToPoint(matrix, shapeLeftTopPoint);
      const routedCenterPoint = applyToPoint(matrix, shapeCenterPoint);
      //■角度の算出
      const startRadian = Math.atan2(originalShape.surface.top - shapeCenterPoint.y, originalShape.surface.left - shapeCenterPoint.x);
      const endRadian = Math.atan2(routedLeftTopPoint.y - routedCenterPoint.y, routedLeftTopPoint.x - routedCenterPoint.x);
      const angle = (((endRadian - startRadian) * 180) / Math.PI);
      //■角度を戻して、left-top座標を算出
      const beforeRoutedMatrix = compose(rotateDEG(angle * -1, routedCenterPoint.x, routedCenterPoint.y));
      const beforeRoutedPoint = applyToPoint(beforeRoutedMatrix, routedLeftTopPoint);
      //■値の反映
      shape.surface.angle = angle;
      shape.surface.left = beforeRoutedPoint.x;
      shape.surface.top = beforeRoutedPoint.y;

      //対象がグループの時は再帰
      if(isGroup(shape)){
        _routeShape(shapes, shape, matrix);
      }
    }
    //■pointの回転
    if(originalShape.points != null){
      originalShape.points.forEach((originPoint, index) => {
        if(shape.points == null)throw Error("originalShape.pointsが存在するのに、shape.pointsが存在しない。");
        if(shape.points.length <= index)throw Error("originalShape.pointsとshape.pointsの数が不一致。");
        const routedPoint = applyToPoint(matrix, {x: originPoint.left, y: originPoint.top});
        shape.points[index] = {left: routedPoint.x, top: routedPoint.y};
      });
    };
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