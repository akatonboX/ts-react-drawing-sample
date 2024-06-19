import React from 'react';
import logo from './logo.svg';
import './App.css';
import { Shape } from './lib/core';
import { rectDriver } from './lib/drivers';
import { Drawing, Viewer } from './lib/ui';
import { applyToPoint, compose, rotate, rotateDEG, scale, translate } from 'transformation-matrix';
import styles from "./App.module.scss";
function App() {
  const [shapes, setShapes] = React.useState([
    {
      id: "1",
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
      id: "2",
      type: "rect",
      left: 50,
      top: 50, 
      width: 100,
      height: 100,
      backgroudColor: "red",
      lineColor: "red",
      angle: 45,
    },
  ]);
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
        </div>
        <Drawing 
          shapeDrivers={[
            rectDriver,
          ]}
          shapes={shapes}
          onChanged={e => {
            setShapes([...shapes.map(shape => {
              const changed = e.changedValues.find(item => item.id === shape.id);
              return changed == null ? shape : changed;
            })]);
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
