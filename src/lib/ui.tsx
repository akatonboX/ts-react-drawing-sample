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
  getOriginal: (shape: Shape) => Shape;
}
export interface SelectionShape{
  id: string;
  shape: Shape;
  original: Shape;
}
type StartEdit = (x: number, y: number, command: string) => void;

export interface DrawingController{
  shapes: Shape[];
  selectedShapes: Shape[];
  select: (shapes: Shape[]) => void;
  addShape: (shape: Shape) => void;
}


function _Drawing(
  props: {
    shapes: Shape[],
    shapeDrivers: ShapeDriver[],
    onChanged: (e: {
     changedValues: Shape[],
    }) => void,
  },
  ref: React.Ref<DrawingController>
) {
  const [logPoint, setLogPoint] = React.useState<{x: number, y:number,color: string}[]>([])
  const svgElementRef = React.useRef<SVGSVGElement>(null);
  
  //■選択されたshapeのクローンを取得する
  const [_selection, _setSelected] = React.useState<SelectionShape[]>([]);
  const clonedSelection = _selection.map(item => lodash.cloneDeep(item.shape));
  const selection: Selection = {
    shapes: clonedSelection,
    clear: () => {_setSelected([]);},
    set: (shapes: Shape[]) => {
      _setSelected(shapes.map(item => {
        return {
          id: item.id,
          shape: lodash.cloneDeep(item),
          original: lodash.cloneDeep(item)
        };
      }));
    },
    append: (shapes: Shape[]) => {
      //■すでに選択済みのものを除外
      const newShapes = shapes.filter(shape => _selection.find(selectedShape => selectedShape.id === shape.id) == null);
      _setSelected([..._selection, ...newShapes.map(item => {
        return {
          id: item.id,
          shape: lodash.cloneDeep(item),
          original: lodash.cloneDeep(item)
        };
      })]);
    },
    save: () => {
      _setSelected(_selection.map(item => {
        return {
          id: item.id,
          shape: clonedSelection.find(clonedShape => clonedShape.id === item.id) ?? item.original,
          original: item.original,
        };
      }));
    },
    getOriginal: (shape: Shape) => {
      const result = _selection.find(item => item.id === shape.id);
      if(result == null)throw new Error("shapeが見つからない");
      return result.original;
    }
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
        if(svgElementRef.current == null)throw Error();

        //■マウスの座標をSVGの座標系に変換
        const svgRect = svgElementRef.current.getBoundingClientRect();
        const startPoint = {x: executeCommandInfo.current.startPoint.x - svgRect.left, y: executeCommandInfo.current.startPoint.y - svgRect.top}
        const currentPoint = {x: event.clientX - svgRect.left, y: event.clientY- svgRect.top}

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
            case "e-resize":
            case "w-resize":
              
              //■回転のアフィン行列
              const matrix = compose(rotateDEG(shape.angle * -1, shape.left + shape.width / 2, shape.top + shape.height / 2));

              //■回転後の各種座標を計算
              const routatedStartPoint = applyToPoint(matrix, startPoint);
              const routatedCurrentPoint = applyToPoint(matrix, currentPoint);
              console.log("★", executeCommandInfo.current.type,startPoint, routatedStartPoint);

              //■変化の差を得る
              const difference = {
                x: routatedCurrentPoint.x - routatedStartPoint.x,
                y: routatedCurrentPoint.y - routatedStartPoint.y,
              }
              switch(executeCommandInfo.current.type){
                case "nw-resize":
                  if(targetShape.width + (difference.x * -1) >= MIN_SHAPE_SIZE){
                    shape.width = targetShape.width + (difference.x * -1);
                    shape.left = targetShape.left + difference.x;
                  }
                  if(targetShape.height + (difference.y * -1) >= MIN_SHAPE_SIZE){
                    shape.height = targetShape.height + (difference.y * -1);
                    shape.top = targetShape.top + difference.y;
                  }
                  break;
                case "e-resize":
                  if(targetShape.width + difference.x >= MIN_SHAPE_SIZE){
                    shape.width = targetShape.width + difference.x;
                  }
                  //■オリジナルの左上座標を計算
                  const originalMatrix = compose(rotateDEG(selection.getOriginal(targetShape).angle, selection.getOriginal(targetShape).left + selection.getOriginal(targetShape).width / 2, selection.getOriginal(targetShape).top + selection.getOriginal(targetShape).height / 2));
                  const originalTopPoint = applyToPoint(originalMatrix, {x: selection.getOriginal(targetShape).left, y: selection.getOriginal(targetShape).top});
                  
                  //■変更後(回転後)の左上座標を計算
                  const newMatrix = compose(rotateDEG(shape.angle, shape.left + shape.width / 2, shape.top + shape.height / 2));
                  const newLeftTopPoint = applyToPoint(newMatrix, {x: shape.left, y: shape.top});

                  //■左上座標を調整
                  shape.left = shape.left - (newLeftTopPoint.x - originalTopPoint.x);
                  shape.top = shape.top - (newLeftTopPoint.y - originalTopPoint.y);
          

                  break;
                case "w-resize":
                  if(targetShape.width + (difference.x * -1) >= MIN_SHAPE_SIZE){
                    shape.width = targetShape.width + (difference.x * -1);
                  }

                  // //■変更後の正しい左下の座標(回転後)を計算
                  // const newMatrix = compose(rotateDEG(shape.angle * -1, shape.left + shape.width / 2, shape.top + shape.height / 2));
                  // const newRoutatedRightBottomPoint = applyToPoint(newMatrix, {x: shape.left + shape.width, y: shape.top + shape.height});
                  // //■変更前の左下の座標(回転後)との差分から、あるべき左上座標(回転後)を計算
                  // const newRoutatedLeftTopPoint = {x: routatedLeftTopPoint.x - (newRoutatedRightBottomPoint.x - routatedRightBottomPoint.x), y: routatedLeftTopPoint.y - (newRoutatedRightBottomPoint.y - routatedRightBottomPoint.y)};
                  // //■回転を戻してあるべき左上座標を計算
                  // const reverseMatrix = compose(rotateDEG(shape.angle, newRoutatedLeftTopPoint.x + shape.width / 2, newRoutatedLeftTopPoint.y + shape.height / 2));
                  // const newLeftTopPoint = applyToPoint(reverseMatrix, newRoutatedLeftTopPoint);
                  // shape.left = newLeftTopPoint.x;
                  // shape.top = newLeftTopPoint.y;

                

                  break;
              }
              break;
            case "rotate":
              const center = {x: shape.left + (shape.width / 2), y: shape.top + (shape.height / 2)};
              const start = {x: startPoint.x, y: startPoint.y};

              const startRadian = Math.atan2(start.y - center.y, start.x - center.x);
              const mouseRadian = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
              shape.angle = (targetShape?.angle ?? 0) + (mouseRadian - startRadian) * (180 / Math.PI); 
              // setLogPoint([
              //   {x: center.x, y: center.y, color: "red"},
              //   {x: start.x, y: start.y, color: "blue"},
              //   {x: mousePoint.x, y: mousePoint.y, color: "green"},
              // ]);

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
    if(svgElementRef.current == null)throw Error();
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
  return (
    <div className={styles.root}>
      <svg ref={svgElementRef} width="500" height="500" onClick={e => {selection.clear();}} >
        <Viewer shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} startEdit={startEdit}/>
        <Editor shapeDrivers={props.shapeDrivers} shapes={props.shapes} selection={selection} startEdit={startEdit} />
        {logPoint.map((item, index) => <circle key={index}cx={item.x} cy={item.y} r={3} fill={item.color}/>)}
      </svg>
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
  }
) {
  const onClick: ShapeMouseEventHandler = (shape, e) => {
    e.stopPropagation();
  };
  const onContextMenu: ShapeMouseEventHandler = (shape, e) => {
    e.stopPropagation();
  };
  const onMousedownWithNoSelectedShape: ShapeMouseEventHandler = (shape, e) => {
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
  const onMousedownWithSelectedShape: ShapeMouseEventHandler = (shape, e) => {
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

          return (
            <g key={shape.id} style={{cursor: selectedTarget != null ? "move" : undefined}} >
            <Component    
              shape={selectedTarget != null ? selectedTarget : shape} 
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
    // onChanged: (shapes: Shape[]) => void,
    
  }
) {
  const iconSize = 24;
  return (
    <>
      {props.selection.shapes.map(item => {
        return (
          <g key={item.id} transform={`rotate(${item.angle}, ${item.left + (item.width / 2)}, ${item.top + (item.height / 2)})`} >
            <rect x={item.left} y={item.top} width={item.width} height={item.height} fill="none" stroke="#F46860" strokeWidth="1"/>
            <DragPoint left={item.left} top={item.top} commnad="nw-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left + (item.width / 2)} top={item.top} commnad="n-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left + item.width} top={item.top} commnad="ne-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left + item.width} top={item.top + (item.height / 2)} commnad="e-resize"  startEdit={props.startEdit} />
            <DragPoint left={item.left + item.width} top={item.top + item.height} commnad="se-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left + (item.width / 2)} top={item.top + item.height} commnad="s-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left} top={item.top + item.height} commnad="sw-resize" startEdit={props.startEdit}/>
            <DragPoint left={item.left} top={item.top + (item.height / 2)} commnad="w-resize" startEdit={props.startEdit}/>
            <svg x={item.left + (item.width / 2) - (iconSize / 2)} y={item.top - (iconSize + 30)} viewBox="0 0 512 512">
              <path fill="white" stroke="black" transform={`scale(${iconSize / 512})`} strokeWidth={512 / iconSize} d="M389.618,88.15l-54.668,78.072c6.58,4.631,12.713,9.726,18.366,15.396
		c25.042,25.057,40.342,59.202,40.374,97.38c-0.032,38.177-15.332,72.258-40.374,97.348c-25.025,24.978-59.17,40.31-97.292,40.31
		c-20.906,0-40.566-4.663-58.197-12.856c-3.689-1.709-7.218-3.57-10.636-5.606c-3.514-1.996-6.868-4.184-10.094-6.452
		c-6.596-4.6-12.728-9.758-18.446-15.396c-24.978-25.089-40.31-59.17-40.31-97.348c0-38.178,15.332-72.323,40.31-97.38
		c16.689-16.657,37.435-28.986,60.751-35.383v41.068l92.534-93.636L219.403,0v48.854C108.105,66.454,23.046,162.74,23.03,278.998
		c0.016,78.926,39.288,148.685,99.385,190.816c5.51,3.857,11.196,7.49,17.104,10.94c5.861,3.33,11.85,6.516,18.031,9.398
		c29.897,13.951,63.244,21.792,98.475,21.848c128.706-0.08,232.93-104.304,232.946-233.002
		C488.97,200.016,449.699,130.32,389.618,88.15z"/>
            </svg>
            <circle r={iconSize / 2} cx={item.left + (item.width / 2)} cy={item.top - ((iconSize / 2) + 30)} fill="rgba(255, 255, 255, 0.01"  style={{cursor: "move"}}  onMouseDown={e => {props.startEdit(e.clientX, e.clientY, "rotate")} } />
            <line x1={item.left + (item.width / 2)} y1={item.top - 30} x2={item.left + (item.width / 2)}  y2={item.top}  stroke="black" strokeWidth={1} />
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

