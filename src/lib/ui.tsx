import React from 'react';
import lodash from 'lodash';
import { Shape, ShapeDriver, ShapeMouseEventHandler } from './core';
import { clientToDrawingPoint } from './util';
import { applyToPoint, compose, rotateDEG } from 'transformation-matrix';
import styles from "./ui.module.scss";
const MIN_SHAPE_SIZE = 30;
interface Selection{
  shapes: Shape[];
  clear: () => void;
  set: (shapes: Shape[]) => void;
  append: (shapes: Shape[]) => void;
  save: () => void;
}

type StartEdit = (x: number, y: number, command: string) => void;

export interface DrawingController{
  shapes: Shape[];
  selectedShapes: Shape[];
  select: (shapes: Shape[]) => void;
  addShape: (shape: Shape) => void;
}

function createZoomedShape(shape: Shape, zoom: number){
  return  {
    id: shape.id,
    type: shape.type,
    left: shape.left * zoom,
    top: shape.top * zoom,
    width: shape.width * zoom,
    height: shape.height * zoom,
    backgroudColor: shape.backgroudColor,
    lineColor: shape.lineColor,
    angle: shape.angle,
  }
}
function _Drawing(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    width: number;
    height: number;
    zoom?: number;
    onChanged: (e: {
     changedValues: Shape[],
    }) => void,
  },
  ref: React.Ref<DrawingController>
) {
  //■zoomを反映した値
  const zoom = props.zoom == null ? 1 : props.zoom / 100;
  const [canvasWidth, canvasHeight] = [props.width * zoom, props.height * zoom];
  const [logPoint, setLogPoint] = React.useState<{x: number, y:number,color: string}[]>([])

  const rootElementRef = React.useRef<HTMLDivElement>(null);
  const canvasRectElementRef = React.useRef<SVGRectElement>(null);

  //■rootElementのサイズ
  const [rootElementSize, setRootElementSize] = React.useState({width: 100, height: 100});
  
  //■SVGのviewbox計算
  const [minX, minY, width, height] = (() => {
    const defaultMargin = 100;
    const xMargin = rootElementSize.width > canvasWidth + defaultMargin ? rootElementSize.width - canvasWidth : defaultMargin;
    const yMargin = rootElementSize.height > canvasHeight + defaultMargin ? rootElementSize.height - canvasHeight : defaultMargin;
    return [(xMargin / 2) * -1, (yMargin / 2) * -1, xMargin + canvasWidth, yMargin + canvasHeight];
  })();

  //■選択されたshapeのクローンを取得する
  const [_selection, _setSelected] = React.useState<Shape[]>([]);
  const clonedSelection = _selection.map(item => lodash.cloneDeep(item));
  const selection: Selection = {
    shapes: clonedSelection,
    clear: () => {_setSelected([]);},
    set: (shapes: Shape[]) => {_setSelected(shapes);},
    append: (shapes: Shape[]) => {
      //■すでに選択済みのものを除外
      const newShapes = shapes.filter(shape => _selection.find(selectedShape => selectedShape.id === shape.id) == null);
      _setSelected([..._selection, ...newShapes]);
    },
    save: () => {_setSelected(clonedSelection);},
  }

  //■コマンドの実行状態
  const executeCommandInfo = React.useRef<null | {
    type: string,
    startPoint: {x: number, y: number},
  }>(null);

  //■マウス操作のイベント
  React.useEffect(() => {
    const mouseupHandler = (event: MouseEvent) => {
      if(executeCommandInfo.current != null){
        //■コマンドを終了する
        executeCommandInfo.current = null;

        //■onChangeイベントを発生
        props.onChanged({changedValues: selection.shapes});
        
        //■selectionを新しいオブジェクトに差し替え
        // _setSelected([...selection.shapes]);
        selection.save();
      }
     
    };
    window.addEventListener('mouseup', mouseupHandler);

    const mousemoveHandler = (event: MouseEvent) => {
      //■ドラッグ中の場合、サイズ変更などを行う
      if(executeCommandInfo.current != null){
        //■現在のマウスのクライアント座標を変換
        if(canvasRectElementRef.current == null)throw Error();

        //■マウスの座標をSVGの座標系に変換(zoomを加味)
        const canvasRect = canvasRectElementRef.current.getBoundingClientRect();
        const startPoint = {x: (executeCommandInfo.current.startPoint.x - canvasRect.left) / zoom, y: (executeCommandInfo.current.startPoint.y - canvasRect.top) / zoom}
        const currentPoint = {x: (event.clientX - canvasRect.left) / zoom, y: (event.clientY- canvasRect.top) / zoom}

        //■座標の変化をshapeに反映
        for(const shape of selection.shapes){
          //■対象のshapeを取得
          const targetShape = props.shapes.find(item => item.id === shape.id);
          if(targetShape == null)break;        

          switch(executeCommandInfo.current.type){
            case "move":
              shape.left = (targetShape?.left ?? 0) + currentPoint.x- startPoint.x;
              shape.top = (targetShape?.top ?? 0) + currentPoint.y - startPoint.y;
              break;

            case "nw-resize":
            case "n-resize":
            case "ne-resize":
            case "e-resize":
            case "se-resize":
            case "s-resize":
            case "sw-resize":
            case "w-resize":
              //■回転後の座標系のマウス座標を、回転前の座標系の座標に変換
              const [routatedStartPoint, routatedCurrentPoint] = (() => {
                const matrix = compose(rotateDEG(shape.angle * -1, shape.left + shape.width / 2, shape.top + shape.height / 2));
                return [applyToPoint(matrix, startPoint), applyToPoint(matrix, currentPoint)];
              })();

              //■変化の差を得る
              const difference = {
                x: (() => {
                  switch(executeCommandInfo.current.type){
                    case "ne-resize":
                    case "e-resize":
                    case "se-resize":
                      return routatedCurrentPoint.x - routatedStartPoint.x;
                    case "nw-resize":
                    case "w-resize": 
                    case "sw-resize":
                      return routatedStartPoint.x - routatedCurrentPoint.x;
                    default: return 0;
                  }
                })(),               
                y: (() => {
                  switch(executeCommandInfo.current.type){
                    case "ne-resize":
                    case "n-resize":
                    case "nw-resize":
                      return  routatedStartPoint.y - routatedCurrentPoint.y;
                    case "se-resize":
                    case "s-resize":
                    case "sw-resize":
                      return routatedCurrentPoint.y - routatedStartPoint.y;
                    default: return 0;
                  }
                })(),   
                
              }

              //■サイズの変更
              if(targetShape.width + difference.x >= MIN_SHAPE_SIZE){
                shape.width = targetShape.width + difference.x;
              }
              if(targetShape.height + difference.y >= MIN_SHAPE_SIZE){
                shape.height = targetShape.height + difference.y;
              }

              //■リサイズ方向によるleftTopの調整(左向きの場合はxをサイズ分マイナス / 上向きの場合はyをサイズ分マイナス)
              shape.left = shape.left + (executeCommandInfo.current.type === "nw-resize" || executeCommandInfo.current.type === "w-resize" || executeCommandInfo.current.type === "sw-resize" ? difference.x : 0);
              shape.top = shape.top + (executeCommandInfo.current.type === "nw-resize" || executeCommandInfo.current.type === "n-resize" || executeCommandInfo.current.type === "ne-resize" ? difference.y : 0);

              //■回転後のオリジナルの差分確認用の座標を得る
              const routatedOriginalPoint = (() => {
                const matrix = compose(rotateDEG(targetShape.angle, targetShape.left + targetShape.width / 2, targetShape.top + targetShape.height / 2));
                const point = (() => {
                  switch(executeCommandInfo.current.type){
                    case "nw-resize": return {x: targetShape.left + targetShape.width, y: targetShape.top + targetShape.height};
                    case "n-resize": return {x: targetShape.left, y: targetShape.top + targetShape.height};
                    case "ne-resize": return {x: targetShape.left, y: targetShape.top + targetShape.height};
                    case "e-resize": return{x: targetShape.left, y: targetShape.top};
                    case "se-resize": return{x: targetShape.left, y: targetShape.top};
                    case "s-resize": return{x: targetShape.left, y: targetShape.top};
                    case "sw-resize": return{x: targetShape.left + targetShape.width, y: targetShape.top};
                    case "w-resize": return{x: targetShape.left + targetShape.width, y: targetShape.top};
                    default: throw Error();
                  }
                })();
                return applyToPoint(matrix, point);
              })();

              //■回転後の差分確認用の座標を得る
              const routatedNewPoint = (() => {
                const matrix = compose(rotateDEG(shape.angle, shape.left + shape.width / 2, shape.top + shape.height / 2));
                const point = (() => {
                  switch(executeCommandInfo.current.type){
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
                })();
                return applyToPoint(matrix, point);
              })();

              //■回転による左上座標を調整
              shape.left = shape.left - (routatedNewPoint.x - routatedOriginalPoint.x);
              shape.top = shape.top - (routatedNewPoint.y - routatedOriginalPoint.y);

              break;
            case "rotate":
              const center = {x: shape.left + (shape.width / 2), y: shape.top + (shape.height / 2)};
              const start = {x: startPoint.x, y: startPoint.y};

              const startRadian = Math.atan2(start.y - center.y, start.x - center.x);
              const mouseRadian = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
              shape.angle = (targetShape?.angle ?? 0) + ((mouseRadian - startRadian) * 180) / Math.PI; 
              break;
          }
        }
        selection.save();
      }
    };
    window.addEventListener('mousemove', mousemoveHandler);
    return () => {
      window.removeEventListener('mouseup', mouseupHandler);
      window.removeEventListener('mousemove', mousemoveHandler);
    };
  }, [_selection]);

  //■マウスの編集を始める
  const startEdit: StartEdit = (x, y, command) => {
    if(canvasRectElementRef.current == null)throw Error();
    executeCommandInfo.current = {
      type: command,
      startPoint: {x: x, y: y},
    }
  }

  //■refを登録
  React.useImperativeHandle(ref, () => {
    return {
      shapes: props.shapes,
      selectedShapes: selection.shapes,
      select: (shapes: Shape[]) => {selection.set([...shapes.map(item => lodash.cloneDeep(item))]);},
      addShape: (shape: Shape) => {
        selection.set([lodash.cloneDeep(shape)]);
        
      },
    };
  });

  //■rootElementのサイズをトラッキングし、変更した場合stateに反映
  React.useEffect(() => {
    const rootElement = rootElementRef.current;
    if(rootElement != null){
      const resizeObserver = new ResizeObserver(entries => {
        if(entries.length > 0){
          setRootElementSize({width: entries[0].contentRect.width, height: entries[0].contentRect.height});
        }
      });
      resizeObserver.observe(rootElement);
      return () => {
        resizeObserver.unobserve(rootElement);
      };
    }
    
    
  },[rootElementRef.current]);



  return (
    <div className={styles.root} ref={rootElementRef}>
      <div>{/* スクロール */}
        <svg width={width} height={height} onClick={e => {selection.clear();}} viewBox={`${minX} ${minY} ${width} ${height}`} >
          <rect //背景
            x={minX} 
            y={minY} 
            width={width} 
            height={height} 
            fill="gray" />
          <rect ref={canvasRectElementRef} //キャンパス
            x={0} 
            y={0} 
            width={canvasWidth} 
            height={canvasHeight} 
            fill="white" />
          <Viewer shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} startEdit={startEdit} zoom={zoom}/>
          <Editor shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} startEdit={startEdit} zoom={zoom} />
          {logPoint.map((item, index) => <circle key={index}cx={item.x} cy={item.y} r={3} fill={item.color}/>)}
        </svg>
      </div>
    </div>
  )
}
export const Drawing = React.forwardRef(_Drawing);

export function Viewer(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    selection: Selection,
    startEdit: StartEdit,
    zoom: number,
  }
) {
  const onClick: ShapeMouseEventHandler = (shapeId, e) => {
    e.stopPropagation();
  };
  const onContextMenu: ShapeMouseEventHandler = (shapeId, e) => {
    e.stopPropagation();
  };
  const onMousedownWithNoSelectedShape: ShapeMouseEventHandler = (shapeId, e) => {
    //■shapeの取得
    const shape = props.shapes.find(item => item.id === shapeId);
    if(shape == null)return;
    //■選択の変更
    if(e.shiftKey){
      props.selection.append([shape]);
    }
    else{
      props.selection.set([shape]);
    }
    //■移動の開始
    props.startEdit(e.clientX, e.clientY, "move");
  };
  const onMousedownWithSelectedShape: ShapeMouseEventHandler = (shapeId, e) => {
    //■移動の開始
    props.startEdit(e.clientX, e.clientY, "move");
  };
  return (
    <>
      {props.shapes.map(shape => {
        const driver = props.shapeDrivers.find(item => item.accept(shape));
        if(driver != null){
          const Component = driver.viewerComponent;
          const selectedTarget = props.selection.shapes.find(item => item.id === shape.id);
          const zoomedShape = createZoomedShape(selectedTarget != null ? selectedTarget : shape, props.zoom);
          
          return (
            <g key={shape.id} style={{cursor: selectedTarget != null ? "move" : undefined}} >
              <Component    
                shape={zoomedShape} 
                onClick={onClick}
                onContextMenu={onContextMenu}
                onMousedown={selectedTarget != null ? onMousedownWithSelectedShape : onMousedownWithNoSelectedShape}
              />
            </g>
          );
        }
        else{
          return <None key={shape.id} />;
        }
      })}
    </>
  );
}

function None(
  props: {
  }
) {
  return <></>;
}

export function Editor(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    selection: Selection,
    startEdit: StartEdit,
    zoom: number;
    // onChanged: (shapes: Shape[]) => void,
    
  }
) {
  const iconSize = 24;
  return (
    <>
      {props.selection.shapes.map(item => {
        const zoomedShape = createZoomedShape(item, props.zoom);
        return (
          <g key={zoomedShape.id} transform={`rotate(${zoomedShape.angle}, ${zoomedShape.left + (zoomedShape.width / 2)}, ${zoomedShape.top + (zoomedShape.height / 2)})`} >
            <rect x={zoomedShape.left} y={zoomedShape.top} width={zoomedShape.width} height={zoomedShape.height} fill="none" stroke="#F46860" strokeWidth="1"/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top} commnad="nw-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left + (zoomedShape.width / 2)} top={zoomedShape.top} commnad="n-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top} commnad="ne-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top + (zoomedShape.height / 2)} commnad="e-resize"  startEdit={props.startEdit} />
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top + zoomedShape.height} commnad="se-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left + (zoomedShape.width / 2)} top={zoomedShape.top + zoomedShape.height} commnad="s-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top + zoomedShape.height} commnad="sw-resize" startEdit={props.startEdit}/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top + (zoomedShape.height / 2)} commnad="w-resize" startEdit={props.startEdit}/>
            <svg x={zoomedShape.left + (zoomedShape.width / 2) - (iconSize / 2)} y={zoomedShape.top - (iconSize + 30)} >
              <path fill="white" stroke="black" transform={`scale(${iconSize / 512})`} strokeWidth={512 / iconSize} d="M389.618,88.15l-54.668,78.072c6.58,4.631,12.713,9.726,18.366,15.396
		c25.042,25.057,40.342,59.202,40.374,97.38c-0.032,38.177-15.332,72.258-40.374,97.348c-25.025,24.978-59.17,40.31-97.292,40.31
		c-20.906,0-40.566-4.663-58.197-12.856c-3.689-1.709-7.218-3.57-10.636-5.606c-3.514-1.996-6.868-4.184-10.094-6.452
		c-6.596-4.6-12.728-9.758-18.446-15.396c-24.978-25.089-40.31-59.17-40.31-97.348c0-38.178,15.332-72.323,40.31-97.38
		c16.689-16.657,37.435-28.986,60.751-35.383v41.068l92.534-93.636L219.403,0v48.854C108.105,66.454,23.046,162.74,23.03,278.998
		c0.016,78.926,39.288,148.685,99.385,190.816c5.51,3.857,11.196,7.49,17.104,10.94c5.861,3.33,11.85,6.516,18.031,9.398
		c29.897,13.951,63.244,21.792,98.475,21.848c128.706-0.08,232.93-104.304,232.946-233.002
		C488.97,200.016,449.699,130.32,389.618,88.15z"/>
            </svg>
            <circle r={iconSize / 2} cx={zoomedShape.left + (zoomedShape.width / 2)} cy={zoomedShape.top - ((iconSize / 2) + 30)} fill="rgba(255, 255, 255, 0.01"  style={{cursor: "move"}}  onMouseDown={e => {props.startEdit(e.clientX, e.clientY, "rotate")} } />            {/* 回転のマウス操作を受け入れるための透明な円 */}
            <line x1={zoomedShape.left + (zoomedShape.width / 2)} y1={zoomedShape.top - 30} x2={zoomedShape.left + (zoomedShape.width / 2)}  y2={zoomedShape.top}  stroke="black" strokeWidth={1} />
          </g>
        );
      })}
    </>
  );

}
type resizeCommand = "nw-resize" | "n-resize" | "ne-resize" | "e-resize" | "se-resize" | "s-resize" | "sw-resize" | "sw-resize" | "w-resize";


function DragPoint(
  props: {
    left: number,
    top: number,
    commnad: resizeCommand,
    startEdit: StartEdit,
    // onMouseDown?: React.MouseEventHandler<SVGCircleElement>,
  }
){
  return <circle cx={props.left} cy={props.top} r="6" fill="white" stroke="black" strokeWidth="1" style={{cursor: props.commnad}} onMouseDown={e => {
    props.startEdit(e.clientX, e.clientY, props.commnad);
  }} />
}

