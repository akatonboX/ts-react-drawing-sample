import { Shape, ShapeDriver } from "./core";

export const rectDriver: ShapeDriver = {
  accept: (shape: Shape) => shape.type === "rect",
  viewerComponent: (props) => {
    return <rect 
            onClick={e => {props.onClick(props.shape, e);}} 
            onContextMenu={e => {props.onContextMenu(props.shape, e);}} 
            onMouseDown={e => {props.onMousedown(props.shape, e);}} 
            x={props.shape.left} 
            y={props.shape.top} 
            width={props.shape.width} 
            height={props.shape.height} 
            stroke={props.shape.lineColor}
            fill={props.shape.backgroudColor} 
            transform={`rotate(${props.shape.angle}, ${props.shape.left + (props.shape.width / 2)}, ${props.shape.top + (props.shape.height / 2)})`}
            />
  },
}