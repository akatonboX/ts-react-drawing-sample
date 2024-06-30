import { Shape, ShapeDriver } from "./core";

export const rectDriver: ShapeDriver = {
  accept: (shape: Shape) => shape.type === "rect",
  viewerComponent: (props) => {
    return <rect 
            onClick={e => {if(props.onClick == null)return;props.onClick(props.shape.id, e);}} 
            onContextMenu={e => {if(props.onContextMenu == null)return;props.onContextMenu(props.shape.id, e);}} 
            onMouseDown={e => {if(props.onMousedown == null)return;props.onMousedown(props.shape.id, e);}} 
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