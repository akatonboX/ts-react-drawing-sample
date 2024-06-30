import React, { MouseEventHandler } from 'react';
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

class MouseEventConnector{
  private handlers: ShapeMouseEventHandler[] = [];
  addListener(handler: ShapeMouseEventHandler){
    this.handlers.push(handler);
  }
  removeListener(handler: ShapeMouseEventHandler){
    this.handlers = [...this.handlers.filter(item => item !== handler)];
  }
  execute: ShapeMouseEventHandler = (shapeId, mouseEvent) => {
    this.handlers.forEach(item => {item(shapeId, mouseEvent);})
  }
}
interface MouseEventConnectorManger{
  onClick: MouseEventConnector;
  onContextMenu: MouseEventConnector;
  onMousedown: MouseEventConnector;
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
export function Drawing(
  props: {
    shapes: Shape[],
    newShape?: Shape,
    shapeDrivers: ShapeDriver[],
    width: number,
    height: number,
    zoom?: number,
    onChanged: (shapes: Shape[]) => void,
  }
) {
  const [logPoint, setLogPoint] = React.useState<{x: number, y:number,color: string}[]>([])

  //■shpaeに対するマウスイベントと、他のコンポーネントでの実行を仲介するオブジェクト
  const mouseEventConnectorManger = React.useRef<MouseEventConnectorManger>({
    onClick: new MouseEventConnector(),
    onContextMenu: new MouseEventConnector(),
    onMousedown: new MouseEventConnector(),
  });
  
  //■elementの保持
  const rootElementRef = React.useRef<HTMLDivElement>(null);
  const documentRectElementRef = React.useRef<SVGRectElement>(null);

  //■rootElementのサイズ
  const [rootElementSize, setRootElementSize] = React.useState({width: 100, height: 100});
  
  //■SVGの実際のサイズ(zoomeを加味)を計算
  const [zoom, svgSize] = (() => {
    const zoom = props.zoom == null ? 1 : props.zoom / 100;//パラメータをrateの変換
    const [documentWidth, documentHeight] = [props.width * zoom, props.height * zoom];//指定されたドキュメントの大きさにzoomeを加味。
    const defaultMargin = 100;
    const xMargin = rootElementSize.width > documentWidth + defaultMargin ? rootElementSize.width - documentWidth : defaultMargin;
    const yMargin = rootElementSize.height > documentHeight + defaultMargin ? rootElementSize.height - documentHeight : defaultMargin;
    // return [(xMargin / 2) * -1, (yMargin / 2) * -1, xMargin + documentWidth, yMargin + documentHeight];
    return [
      zoom, 
      {
        minX: (xMargin / 2) * -1,//SVGの左上のX座標。(0はマージンを除く編集領域音開始座標になるので、左上は負数)
        minY:  (yMargin / 2) * -1,//SVGの左上のY座標。(0はマージンを除く編集領域音開始座標になるので、左上は負数)
        width: xMargin + documentWidth,//SVGの幅。(マージンを含む)
        height: yMargin + documentHeight,//SGVの高さ(マージンを含む)
        documentWidth: documentWidth,//マージンを含まないドキュメントサイズ
        documentHeight: documentHeight,//マージンを含まないドキュメントサイズ
      }
    ];
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
        <svg width={svgSize.width} height={svgSize.height} onClick={e => {selection.clear();}} viewBox={`${svgSize.minX} ${svgSize.minY} ${svgSize.width} ${svgSize.height}`} >
          <rect //背景
            x={svgSize.minX} 
            y={svgSize.minY} 
            width={svgSize.width} 
            height={svgSize.height} 
            fill="gray" />
          <rect ref={documentRectElementRef} //キャンパス
            x={0} 
            y={0} 
            width={svgSize.documentWidth} 
            height={svgSize.documentHeight} 
            fill="white" />
          <Viewer shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} mouseEventConnectorManger={mouseEventConnectorManger.current} zoom={zoom}/>
          {documentRectElementRef.current != null ?
            <Editor shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} mouseEventConnectorManger={mouseEventConnectorManger.current} zoom={zoom} documentElementRect={documentRectElementRef.current.getBoundingClientRect()} onChanged={props.onChanged} />
            : <></>}
          {props.newShape != null && documentRectElementRef.current != null ?
            <Appender shapes={props.shapes} zoom={zoom} newShape={props.newShape} svgSize={svgSize} documentElementRect={documentRectElementRef.current.getBoundingClientRect()} onChanged={props.onChanged} />
            : <></>}
          
          {logPoint.map((item, index) => <circle key={index}cx={item.x} cy={item.y} r={3} fill={item.color}/>)}
        </svg>
      </div>
    </div>
  )
}

function Viewer(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    selection: Selection,
    mouseEventConnectorManger: MouseEventConnectorManger,
    zoom: number,
  }
) {
   
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
                onClick={(shapeId, e) => {props.mouseEventConnectorManger.onClick.execute(shapeId, e)}}
                onContextMenu={(shapeId, e) => {props.mouseEventConnectorManger.onContextMenu.execute(shapeId, e)}}
                onMousedown={(shapeId, e) => {props.mouseEventConnectorManger.onMousedown.execute(shapeId, e)}}
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

function Editor(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    selection: Selection,
    mouseEventConnectorManger: MouseEventConnectorManger,
    zoom: number,
    documentElementRect: {
      top: number,
      left: number,
      width: number,
      height: number,
    },
    onChanged: (shapes: Shape[]) => void,  
  }
) {
  //■操作の実行状態
  const executeCommandInfo = React.useRef<null | {
    type: string,
    startPoint: {x: number, y: number},
  }>(null);
  const startEdit = (startX: number, startY: number, command: string) => {
    executeCommandInfo.current = {
      type: command,
      startPoint: {x: startX, y: startY},
    }
  }
  //■ShapeにonMousedownのイベント登録
  React.useEffect(() => {
    const onMousedownHandler: ShapeMouseEventHandler = (shapeId, e) => {
      if(executeCommandInfo.current == null){
        e.stopPropagation();

        //■対象のshpaeが未選択の場合、対象のshapeを選択に含める。
        if(props.selection.shapes.find(item => item.id === shapeId) == null){
          const targetShape = props.shapes.find(item => item.id === shapeId);
          if(targetShape == null)throw Error(`idが存在しない。id=${shapeId}`);
          if(e.shiftKey){
            props.selection.append([targetShape]);
          }
          else{
            props.selection.set([targetShape]);
          }
        }
        
        //■移動の開始
        startEdit(e.clientX, e.clientY, "move");
      }
    };
    props.mouseEventConnectorManger.onMousedown.addListener(onMousedownHandler);

    return () => {
      props.mouseEventConnectorManger.onMousedown.removeListener(onMousedownHandler);
    };
  }, [props.shapes, props.selection]);
  //■ShapeにonClickのイベント登録
  React.useEffect(() => {
    const onClickHandler: ShapeMouseEventHandler = (shapeId, e) => {
      e.stopPropagation();
    };
    props.mouseEventConnectorManger.onClick.addListener(onClickHandler);

    return () => {
      props.mouseEventConnectorManger.onClick.removeListener(onClickHandler);
    };
  }, []);
  //■ShapeにonContextMenuのイベント登録
  React.useEffect(() => {
    const onContextMenuHandler: ShapeMouseEventHandler = (shapeId, e) => {
      e.stopPropagation();
    };
    props.mouseEventConnectorManger.onContextMenu.addListener(onContextMenuHandler);

    return () => {
      props.mouseEventConnectorManger.onContextMenu.removeListener(onContextMenuHandler);
    };
  }, []);

  //■mouseupイベントの登録
  React.useEffect(() => {
    const onMouseUpHandler = (event: MouseEvent) => {
      if(executeCommandInfo.current != null){
        //■コマンドを終了する
        executeCommandInfo.current = null;

        //■onChangeイベントを発生
        props.onChanged(props.shapes.map(shape => props.selection.shapes.find(item => item.id === shape.id) ?? shape));
        
        //■selectionを新しいオブジェクトに差し替え
        props.selection.save();
      }
     
    };
    window.addEventListener('mouseup', onMouseUpHandler);
    return () => {
      window.removeEventListener('mouseup', onMouseUpHandler);
    };
  }, [props.shapes, props.selection]);

  //■mousemoveイベントの登録
  React.useEffect(() => {
    const onMouseMoveHandler = (event: MouseEvent) => {
      //■ドラッグ中の場合、サイズ変更などを行う
      if(executeCommandInfo.current != null){

        //■マウスの座標をSVGの座標系に変換(zoomを加味)
        const startPoint = {x: (executeCommandInfo.current.startPoint.x - props.documentElementRect.left) / props.zoom, y: (executeCommandInfo.current.startPoint.y - props.documentElementRect.top) / props.zoom}
        const currentPoint = {x: (event.clientX - props.documentElementRect.left) / props.zoom, y: (event.clientY- props.documentElementRect.top) / props.zoom}

        //■座標の変化をshapeに反映
        for(const shape of props.selection.shapes){
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
        props.selection.save();
      }
    };
    window.addEventListener('mousemove', onMouseMoveHandler);
    return () => {
      window.removeEventListener('mousemove', onMouseMoveHandler);
    };
  }, [props.selection, props.documentElementRect.left, props.documentElementRect.top, props.zoom]);

  const iconSize = 24;
  return (
    <>
      {props.selection.shapes.map(item => {
        const zoomedShape = createZoomedShape(item, props.zoom);
        return (
          <g key={zoomedShape.id} transform={`rotate(${zoomedShape.angle}, ${zoomedShape.left + (zoomedShape.width / 2)}, ${zoomedShape.top + (zoomedShape.height / 2)})`} >
            <rect x={zoomedShape.left} y={zoomedShape.top} width={zoomedShape.width} height={zoomedShape.height} fill="none" stroke="#F46860" strokeWidth="1"/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top} commnad="nw-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left + (zoomedShape.width / 2)} top={zoomedShape.top} commnad="n-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top} commnad="ne-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top + (zoomedShape.height / 2)} commnad="e-resize"  startEdit={startEdit} />
            <DragPoint left={zoomedShape.left + zoomedShape.width} top={zoomedShape.top + zoomedShape.height} commnad="se-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left + (zoomedShape.width / 2)} top={zoomedShape.top + zoomedShape.height} commnad="s-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top + zoomedShape.height} commnad="sw-resize" startEdit={startEdit}/>
            <DragPoint left={zoomedShape.left} top={zoomedShape.top + (zoomedShape.height / 2)} commnad="w-resize" startEdit={startEdit}/>
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
            {/* 回転のマウス操作を受け入れるための透明な円 */}
            <circle r={iconSize / 2} cx={zoomedShape.left + (zoomedShape.width / 2)} cy={zoomedShape.top - ((iconSize / 2) + 30)} fill="rgba(255, 255, 255, 0.01)"  style={{cursor: "move"}}  onMouseDown={e => {startEdit(e.clientX, e.clientY, "rotate")} } />         
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
    startEdit:  (startX: number, startY: number, command: string) => void,
  }
){
  return <circle cx={props.left} cy={props.top} r="6" fill="white" stroke="black" strokeWidth="1" style={{cursor: props.commnad}} onMouseDown={e => {
    props.startEdit(e.clientX, e.clientY, props.commnad);
  }} />
}


function Appender(
  props: {
    newShape: Shape,
    shapes: Shape[],
    zoom: number,
    documentElementRect: {
      top: number,
      left: number,
      width: number,
      height: number,
    },
    svgSize: {
      minX: number,
      minY: number,
      width: number,
      height: number,
    },
    onChanged: (shapes: Shape[]) => void,
  }
) {
  return <rect style={{cursor: "crosshair"}} 
            onClick={e => {
              //■マウスの座標をSVGの座標系に変換(zoomを加味)
              const currentPoint = {x: (e.clientX - props.documentElementRect.left) / props.zoom, y: (e.clientY- props.documentElementRect.top) / props.zoom};

              //■新しいshapeの構築
              const newShape = lodash.cloneDeep(props.newShape);
              newShape.left = currentPoint.x;
              newShape.top = currentPoint.y;
              newShape.id = window.crypto.randomUUID();

              //■変更を通知
              props.onChanged([...props.shapes, newShape]);
            }} 

            x={props.svgSize.minX} 
            y={props.svgSize.minY} 
            width={props.svgSize.width} 
            height={props.svgSize.height} 
            stroke="rgba(255, 255, 255, 0.01)"
            fill="rgba(255, 255, 255, 0.01)"
          />
}
