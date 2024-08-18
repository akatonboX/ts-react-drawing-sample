import { FC } from "react";
import { Group, Shape, ShapeDriver, ShapeMouseEventHandler, isGroup } from "./core";

export const rectDriver: ShapeDriver = {
  accept: (shape: Shape) => shape.type === "rect",
  viewerComponent: (props) => {
    if(props.shape.surface == null)return <></>;
    return <rect 
            onClick={e => {if(props.onClick == null)return;props.onClick(props.shape.id, e);}} 
            onContextMenu={e => {if(props.onContextMenu == null)return;props.onContextMenu(props.shape.id, e);}} 
            onMouseDown={e => {if(props.onMousedown == null)return;props.onMousedown(props.shape.id, e);}} 
            x={props.shape.surface.left} 
            y={props.shape.surface.top} 
            width={props.shape.surface.width} 
            height={props.shape.surface.height} 
            stroke={props.shape.line.color}
            fill={props.shape.surface.backgroudColor} 
            transform={`rotate(${props.shape.surface.angle}, ${props.shape.surface.left + (props.shape.surface.width / 2)}, ${props.shape.surface.top + (props.shape.surface.height / 2)})`}
            />
  },
}


export const lineDriver: ShapeDriver = {
  accept: (shape: Shape) => shape.type === "line",
  viewerComponent: (props) => {
    if(props.shape.points == null || props.shape.points.length < 2)return <></>;

    return (<>
      {/* 実際の線 */}
      <line 
        x1={props.shape.points[0].left} 
        y1={props.shape.points[0].top} 
        x2={props.shape.points[1].left}  
        y2={props.shape.points[1].top} 
        stroke="black" />
      {/* マウス操作を受け付けるためのエリアとしての線 */}
      <line strokeWidth={10}
        onClick={e => {if(props.onClick == null)return;props.onClick(props.shape.id, e);}} 
        onContextMenu={e => {if(props.onContextMenu == null)return;props.onContextMenu(props.shape.id, e);}} 
        onMouseDown={e => {if(props.onMousedown == null)return;props.onMousedown(props.shape.id, e);}} 
        x1={props.shape.points[0].left} 
        y1={props.shape.points[0].top} 
        x2={props.shape.points[1].left}  
        y2={props.shape.points[1].top} 
        stroke="rgba(255, 255, 255, 0.01)" />
    </>);
  },
}