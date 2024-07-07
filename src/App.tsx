import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Group, Shape, ShapeDriver, ajustGroup, isGroup } from './lib/core';
import { rectDriver } from './lib/drivers';
import { Drawing } from './lib/ui';
import { applyToPoint, compose, rotate, rotateDEG, scale, translate } from 'transformation-matrix';
import styles from "./App.module.scss";
import { Slider, drawerClasses } from '@mui/material';
import { ExpandableLayout } from './component/expandableLayout';
import { GroupMenuItem, UnGroupMenuItem } from './lib/menuItem';

interface AppendItem{
  label: string;
  shape: Shape;
  icon?: SVGElement;
}
  
function App() {
  const appendItems: AppendItem[] = [
    {
      label: "四角形",
      shape: {
        id: window.crypto.randomUUID(),
        type: "rect",
        left: 0,
        top: 0, 
        width: 100,
        height: 100,
        backgroudColor: "white",
        lineColor: "black",
        angle: 0,
      }
    },
    {
      label: "四角形",
      shape: {
        id: window.crypto.randomUUID(),
        type: "rect",
        left: 0,
        top: 0, 
        width: 100,
        height: 100,
        backgroudColor: "red",
        lineColor: "black",
        angle: 0,
      }
    },
  ];
  const shapeDrivers =[
    rectDriver,
  ];
  const data = [
    {
      id: window.crypto.randomUUID(),
      type: "rect",
      
      left: 50,
      top: 50, 
      width: 100,
      height: 100,
      backgroudColor: "blue",
      lineColor: "blue",
      angle: 0,
    },
    {
      id: window.crypto.randomUUID(),
      type: "rect",
      left: 50,
      top: 50, 
      width: 100,
      height: 100,
      backgroudColor: "red",
      lineColor: "red",
      angle: 45,
    },
    {
      id: window.crypto.randomUUID(),
      type: "group",
      left: 0,
      top: 0, 
      width: 0,
      height: 0,
      backgroudColor: "red",
      lineColor: "red",
      angle: 0,
      shapes: [
        {
          id: window.crypto.randomUUID(),
          type: "rect",
          
          left: 150,
          top: 150, 
          width: 100,
          height: 100,
          backgroudColor: "blue",
          lineColor: "blue",
          angle: 0,
        },
        {
          id: window.crypto.randomUUID(),
          type: "rect",
          left: 200,
          top: 200, 
          width: 100,
          height: 100,
          backgroudColor: "red",
          lineColor: "red",
          angle: 0,
        },
        {
          id: window.crypto.randomUUID(),
          type: "group",
          left: 0,
          top: 0, 
          width: 0,
          height: 0,
          backgroudColor: "red",
          lineColor: "red",
          angle: 0,
          shapes: [
            {
              id: window.crypto.randomUUID(),
              type: "rect",
              
              left: 300,
              top: 300, 
              width: 100,
              height: 100,
              backgroudColor: "blue",
              lineColor: "blue",
              angle: 0,
            },
            {
              id: window.crypto.randomUUID(),
              type: "rect",
              left: 350,
              top: 350, 
              width: 100,
              height: 100,
              backgroudColor: "red",
              lineColor: "red",
              angle: 0,
            },
          ]
        },
      ]
    },
  ];
  data.forEach(item => {if(isGroup(item)){ajustGroup(item);}});
  const [shapes, setShapes] = React.useState<(Shape | Group)[]>(data);
  
  const [zoom, setZoom] = React.useState(100);
  const [newShape, setNewShape] = React.useState<Shape | undefined>(undefined);
  return (
    <div className={styles.root} style={{border: "solid 1px black"}}>
      <div> {/* ヘッダ */}
      <button onClick={e => {
        const matrix = compose(
          // translate(40,40),
          rotateDEG(45),
          // scale(2, 4)
        );
        const a = applyToPoint(matrix, {x: 10, y: 10});
        console.log(a);
      }}>aaa</button>
      </div>
      <div>{/* コンテンツ  */}
        <div> {/* tools */}
          <div>{/* 左詰め */}
            <div className={styles.appendItems}>
              {
                appendItems.map(item => {return {appendItem: item, driver: shapeDrivers.find(driver => driver.accept(item.shape))};})
                .filter(item => item.driver != null)//ドライバが見つからないものを除く
                .map(item => item as {appendItem: AppendItem, driver: ShapeDriver})
                .map(item => {
                  return (
                    <div 
                      key={item.appendItem.shape.id} 
                      style={newShape?.id === item.appendItem.shape.id ? {backgroundColor: "#F5F5F5", border: "1px solid #C7C7C7"} : undefined}
                      onClick={e => {setNewShape(item.appendItem.shape);console.log("★★")}}>
                      <svg width={24} height={24} viewBox={`${item.appendItem.shape.left} ${item.appendItem.shape.top} ${item.appendItem.shape.width} ${item.appendItem.shape.height}`}>
                        <item.driver.viewerComponent key={item.appendItem.shape.id} shape={item.appendItem.shape}/>
                      </svg>
                    </div>
                  );
                })
              }
            </div>
          </div>
          <div />{/* 中央 */}
          <div>{/* 左詰め */}
            <div style={{width:100}}>
              <Slider value={zoom} max={200} min={20} onChange={(e, newValue) => {setZoom(newValue as number);}} />
            </div>
            <div>{zoom}%</div>
          </div>
          
        </div>
        <Drawing
          shapeDrivers={shapeDrivers}
          width={500}
          height={500}
          zoom={zoom}
          shapes={shapes}
          newShape={newShape}
          contextMenuItems={[
            new GroupMenuItem("グループ化"),
            new UnGroupMenuItem("グループ解除"),
          ]}
          onChanged={shapes => {
            console.log("★onchange", shapes)
            setShapes(shapes);
            setNewShape(undefined);
          }}
        />
      </div>
      <div> {/* フッダ */}
        <div>
          コピーライト！
        </div>
      </div>

      
      
    </div>
  );
}

export default App;
